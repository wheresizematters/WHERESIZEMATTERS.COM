terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  project = "size"
}

# ── Profiles ────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "profiles" {
  name         = "${local.project}-profiles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"             type = "S" }
  attribute { name = "username"       type = "S" }
  attribute { name = "wallet_address" type = "S" }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "wallet-index"
    hash_key        = "wallet_address"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  tags = { Project = local.project }
}

# ── Posts ───────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "posts" {
  name         = "${local.project}-posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"      type = "S" }
  attribute { name = "user_id" type = "S" }

  global_secondary_index {
    name            = "user-posts-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  tags = { Project = local.project }
}

# ── Poll Options ────────────────────────────────────────────────────

resource "aws_dynamodb_table" "poll_options" {
  name         = "${local.project}-poll-options"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"      type = "S" }
  attribute { name = "post_id" type = "S" }

  global_secondary_index {
    name            = "post-options-index"
    hash_key        = "post_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

# ── Votes (poll) ────────────────────────────────────────────────────

resource "aws_dynamodb_table" "votes" {
  name         = "${local.project}-votes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "poll_option_id"
  range_key    = "user_id"

  attribute { name = "poll_option_id" type = "S" }
  attribute { name = "user_id"        type = "S" }

  tags = { Project = local.project }
}

# ── Post Votes (upvote/downvote) ────────────────────────────────────

resource "aws_dynamodb_table" "post_votes" {
  name         = "${local.project}-post-votes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"
  range_key    = "user_id"

  attribute { name = "post_id" type = "S" }
  attribute { name = "user_id" type = "S" }

  tags = { Project = local.project }
}

# ── Comments ────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "comments" {
  name         = "${local.project}-comments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "post_id"
  range_key    = "id"

  attribute { name = "post_id" type = "S" }
  attribute { name = "id"      type = "S" }

  tags = { Project = local.project }
}

# ── Conversations (DM) ─────────────────────────────────────────────

resource "aws_dynamodb_table" "conversations" {
  name         = "${local.project}-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"        type = "S" }
  attribute { name = "user_1_id" type = "S" }
  attribute { name = "user_2_id" type = "S" }

  global_secondary_index {
    name            = "user1-index"
    hash_key        = "user_1_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "user2-index"
    hash_key        = "user_2_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

# ── Messages (DM) ──────────────────────────────────────────────────

resource "aws_dynamodb_table" "messages" {
  name         = "${local.project}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "conversation_id"
  range_key    = "id"

  attribute { name = "conversation_id" type = "S" }
  attribute { name = "id"              type = "S" }

  tags = { Project = local.project }
}

# ── Follows ─────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "follows" {
  name         = "${local.project}-follows"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "follower_id"
  range_key    = "following_id"

  attribute { name = "follower_id"  type = "S" }
  attribute { name = "following_id" type = "S" }

  global_secondary_index {
    name            = "following-index"
    hash_key        = "following_id"
    range_key       = "follower_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

# ── Verification Requests ──────────────────────────────────────────

resource "aws_dynamodb_table" "verifications" {
  name         = "${local.project}-verifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"      type = "S" }
  attribute { name = "user_id" type = "S" }

  global_secondary_index {
    name            = "user-verification-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

# ═══════════════════════════════════════════════════════════════════
# NEW: Group Chats
# ═══════════════════════════════════════════════════════════════════

resource "aws_dynamodb_table" "groups" {
  name         = "${local.project}-groups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id" type = "S" }

  point_in_time_recovery { enabled = true }
  tags = { Project = local.project }
}

resource "aws_dynamodb_table" "group_members" {
  name         = "${local.project}-group-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "group_id"
  range_key    = "user_id"

  attribute { name = "group_id" type = "S" }
  attribute { name = "user_id"  type = "S" }

  global_secondary_index {
    name            = "user-groups-index"
    hash_key        = "user_id"
    range_key       = "group_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

resource "aws_dynamodb_table" "group_messages" {
  name         = "${local.project}-group-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "group_id"
  range_key    = "id"

  attribute { name = "group_id" type = "S" }
  attribute { name = "id"       type = "S" }

  tags = { Project = local.project }
}

# ═══════════════════════════════════════════════════════════════════
# NEW: Communities
# ═══════════════════════════════════════════════════════════════════

resource "aws_dynamodb_table" "communities" {
  name         = "${local.project}-communities"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute { name = "id"   type = "S" }
  attribute { name = "slug" type = "S" }

  global_secondary_index {
    name            = "slug-index"
    hash_key        = "slug"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  tags = { Project = local.project }
}

resource "aws_dynamodb_table" "community_members" {
  name         = "${local.project}-community-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "community_id"
  range_key    = "user_id"

  attribute { name = "community_id" type = "S" }
  attribute { name = "user_id"      type = "S" }

  global_secondary_index {
    name            = "user-communities-index"
    hash_key        = "user_id"
    range_key       = "community_id"
    projection_type = "ALL"
  }

  tags = { Project = local.project }
}

resource "aws_dynamodb_table" "community_posts" {
  name         = "${local.project}-community-posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "community_id"
  range_key    = "id"

  attribute { name = "community_id" type = "S" }
  attribute { name = "id"           type = "S" }

  tags = { Project = local.project }
}

# ── API Server EC2 ──────────────────────────────────────────────────

resource "aws_iam_role" "api" {
  name = "${local.project}-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "api_dynamo" {
  name = "${local.project}-api-dynamo"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:*"]
      Resource = ["arn:aws:dynamodb:${var.aws_region}:*:table/${local.project}-*"]
    }]
  })
}

resource "aws_iam_instance_profile" "api" {
  name = "${local.project}-api-profile"
  role = aws_iam_role.api.name
}

resource "aws_security_group" "api" {
  name        = "${local.project}-api-sg"
  description = "SIZE API server"

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "api" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.api.name
  vpc_security_group_ids = [aws_security_group.api.id]

  user_data = <<-EOF
    #!/bin/bash
    yum install -y docker
    systemctl enable docker && systemctl start docker
    docker run -d \
      --name size-api \
      --restart always \
      -p 3000:3000 \
      -e AWS_REGION="${var.aws_region}" \
      -e SUPABASE_URL="${var.supabase_url}" \
      -e SUPABASE_ANON_KEY="${var.supabase_anon_key}" \
      ${var.api_image}
  EOF

  tags = { Name = "${local.project}-api", Project = local.project }
}
