variable "aws_region" {
  default = "us-east-1"
}

variable "project" {
  default = "size-staking"
}

variable "ecr_image" {
  description = "ECR image URI for the indexer"
  type        = string
}

variable "base_rpc_url" {
  description = "Base mainnet RPC URL"
  type        = string
  sensitive   = true
}

variable "base_wss_url" {
  description = "Base mainnet WSS URL"
  type        = string
  sensitive   = true
}

variable "staking_contract_address" {
  description = "Deployed SizeStaking contract address"
  type        = string
}

variable "size_token_address" {
  description = "$SIZE ERC-20 contract address"
  type        = string
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_service_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "fee_collector_private_key" {
  description = "Private key for fee collector wallet (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "instance_type" {
  default = "t3.small"
}
