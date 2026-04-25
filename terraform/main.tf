terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ------------------------------------------------------------------------------
# Google Cloud Run Service
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "election_saathi" {
  name     = "election-saathi-india"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "gcr.io/${var.project_id}/election-saathi-india:latest"
      
      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }

      # Ensure secure execution
      security_context {
        run_as_non_root = true
      }
    }
    
    scaling {
      min_instance_count = 0
      max_instance_count = 100
    }
  }
}

# Allow public access
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.election_saathi.location
  project  = google_cloud_run_v2_service.election_saathi.project
  service  = google_cloud_run_v2_service.election_saathi.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ------------------------------------------------------------------------------
# Outputs
# ------------------------------------------------------------------------------
output "service_url" {
  value       = google_cloud_run_v2_service.election_saathi.uri
  description = "The public URL of the Election Saathi Cloud Run service."
}
