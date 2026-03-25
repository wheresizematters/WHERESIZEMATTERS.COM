terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── DynamoDB Tables ─────────────────────────────────────────────────

resource "aws_dynamodb_table" "positions" {
  name         = "${var.project}-positions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "wallet_address"

  attribute {
    name = "wallet_address"
    type = "S"
  }

  point_in_time_recovery { enabled = true }

  tags = { Project = var.project }
}

resource "aws_dynamodb_table" "events" {
  name         = "${var.project}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "wallet_address"
  range_key    = "sort_key"

  attribute {
    name = "wallet_address"
    type = "S"
  }

  attribute {
    name = "sort_key"
    type = "S"
  }

  attribute {
    name = "event_type"
    type = "S"
  }

  global_secondary_index {
    name            = "event_type-index"
    hash_key        = "event_type"
    range_key       = "sort_key"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }

  tags = { Project = var.project }
}

resource "aws_dynamodb_table" "activity" {
  name         = "${var.project}-activity-scores"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "wallet_address"

  attribute {
    name = "wallet_address"
    type = "S"
  }

  attribute {
    name = "supabase_user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "supabase-user-index"
    hash_key        = "supabase_user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }

  tags = { Project = var.project }
}

resource "aws_dynamodb_table" "snapshots" {
  name         = "${var.project}-snapshots"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "snapshot_date"
  range_key    = "snapshot_hour"

  attribute {
    name = "snapshot_date"
    type = "S"
  }

  attribute {
    name = "snapshot_hour"
    type = "S"
  }

  tags = { Project = var.project }
}

# ── S3 Audit Bucket ────────────────────────────────────────────────

resource "aws_s3_bucket" "audit_logs" {
  bucket = "${var.project}-audit-logs"
  tags   = { Project = var.project }
}

resource "aws_s3_bucket_versioning" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket                  = aws_s3_bucket.audit_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

# ── IAM Role for EC2 ───────────────────────────────────────────────

resource "aws_iam_role" "indexer" {
  name = "${var.project}-indexer-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "indexer_dynamo" {
  name = "${var.project}-dynamo-access"
  role = aws_iam_role.indexer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
        "dynamodb:Query", "dynamodb:Scan", "dynamodb:DeleteItem",
        "dynamodb:BatchGetItem", "dynamodb:BatchWriteItem"
      ]
      Resource = [
        aws_dynamodb_table.positions.arn,
        aws_dynamodb_table.events.arn,
        "${aws_dynamodb_table.events.arn}/index/*",
        aws_dynamodb_table.activity.arn,
        "${aws_dynamodb_table.activity.arn}/index/*",
        aws_dynamodb_table.snapshots.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy" "indexer_s3" {
  name = "${var.project}-s3-access"
  role = aws_iam_role.indexer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
      Resource = [
        aws_s3_bucket.audit_logs.arn,
        "${aws_s3_bucket.audit_logs.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_instance_profile" "indexer" {
  name = "${var.project}-indexer-profile"
  role = aws_iam_role.indexer.name
}

# ── Security Group ──────────────────────────────────────────────────

resource "aws_security_group" "indexer" {
  name        = "${var.project}-indexer-sg"
  description = "SIZE staking indexer"

  ingress {
    description = "API"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Tighten this to your IP in production
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Project = var.project }
}

# ── EC2 Instance ────────────────────────────────────────────────────

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "indexer" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.indexer.name
  vpc_security_group_ids = [aws_security_group.indexer.id]

  user_data = <<-EOF
    #!/bin/bash
    yum install -y docker
    systemctl enable docker && systemctl start docker

    # Pull and run indexer container
    docker run -d \
      --name size-indexer \
      --restart always \
      -p 3001:3001 \
      -e BASE_RPC_URL="${var.base_rpc_url}" \
      -e BASE_WSS_URL="${var.base_wss_url}" \
      -e STAKING_CONTRACT_ADDRESS="${var.staking_contract_address}" \
      -e SIZE_TOKEN_ADDRESS="${var.size_token_address}" \
      -e SUPABASE_URL="${var.supabase_url}" \
      -e SUPABASE_SERVICE_ROLE_KEY="${var.supabase_service_key}" \
      -e FEE_COLLECTOR_PRIVATE_KEY="${var.fee_collector_private_key}" \
      -e AWS_REGION="${var.aws_region}" \
      -e S3_AUDIT_BUCKET="${aws_s3_bucket.audit_logs.id}" \
      -e DYNAMO_POSITIONS_TABLE="${aws_dynamodb_table.positions.name}" \
      -e DYNAMO_EVENTS_TABLE="${aws_dynamodb_table.events.name}" \
      -e DYNAMO_ACTIVITY_TABLE="${aws_dynamodb_table.activity.name}" \
      -e DYNAMO_SNAPSHOTS_TABLE="${aws_dynamodb_table.snapshots.name}" \
      ${var.ecr_image}
  EOF

  tags = { Name = "${var.project}-indexer", Project = var.project }
}

# ── CloudWatch Alarms ───────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.project}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Indexer CPU above 80% for 15 minutes"

  dimensions = { InstanceId = aws_instance.indexer.id }
}
