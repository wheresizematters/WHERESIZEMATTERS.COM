variable "aws_region" {
  default = "us-east-1"
}

variable "instance_type" {
  default = "t3.small"
}

variable "api_image" {
  description = "Docker image URI for the SIZE API server"
  type        = string
}

variable "supabase_url" {
  description = "Supabase project URL (for auth verification)"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anon key (for auth verification)"
  type        = string
  sensitive   = true
}
