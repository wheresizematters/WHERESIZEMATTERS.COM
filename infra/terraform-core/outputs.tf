output "api_public_ip" {
  value       = aws_instance.api.public_ip
  description = "Public IP of the SIZE API server"
}

output "tables" {
  value = {
    profiles          = aws_dynamodb_table.profiles.name
    posts             = aws_dynamodb_table.posts.name
    poll_options      = aws_dynamodb_table.poll_options.name
    votes             = aws_dynamodb_table.votes.name
    post_votes        = aws_dynamodb_table.post_votes.name
    comments          = aws_dynamodb_table.comments.name
    conversations     = aws_dynamodb_table.conversations.name
    messages          = aws_dynamodb_table.messages.name
    follows           = aws_dynamodb_table.follows.name
    verifications     = aws_dynamodb_table.verifications.name
    groups            = aws_dynamodb_table.groups.name
    group_members     = aws_dynamodb_table.group_members.name
    group_messages    = aws_dynamodb_table.group_messages.name
    communities       = aws_dynamodb_table.communities.name
    community_members = aws_dynamodb_table.community_members.name
    community_posts   = aws_dynamodb_table.community_posts.name
  }
}
