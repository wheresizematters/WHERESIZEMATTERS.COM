output "indexer_public_ip" {
  value       = aws_instance.indexer.public_ip
  description = "Public IP of the staking indexer EC2 instance"
}

output "s3_bucket" {
  value = aws_s3_bucket.audit_logs.id
}

output "dynamodb_tables" {
  value = {
    positions = aws_dynamodb_table.positions.name
    events    = aws_dynamodb_table.events.name
    activity  = aws_dynamodb_table.activity.name
    snapshots = aws_dynamodb_table.snapshots.name
  }
}
