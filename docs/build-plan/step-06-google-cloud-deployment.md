# Step 6 Deploy an Optional Demo to Google Cloud

**Depends on:** Local app/container behavior from Steps 1–5.  
**Outcome:** A shareable HTTPS demo on Cloud Run. This step is optional; Google Cloud is not required for local development.

## Function

Use Google Cloud for a hosted demo without changing R1 product scope. Deploy separate web and API containers, route browser traffic through one HTTPS origin, and keep Cloud Run services inaccessible through their direct default URLs. The Google Cloud Console is the resource-management UI, not a runtime service.

## Required services and setup

| Service/resource | Function |
|---|---|
| Google Cloud project and billing | Owns resources and enables billable services; configure budget notifications before demo use |
| Cloud Build | Builds container images from connected source or submitted build context |
| Artifact Registry | Stores private versioned web and API images |
| Cloud Run `web` and `api` | Runs Nginx/React and Express as separate services |
| External HTTPS Application Load Balancer | Provides one HTTPS entry point and routes by path |
| Serverless NEGs and URL map | Connect Cloud Run services to load balancer and direct `/api/*` vs app paths |
| IAM/service identities | Restrict deployer and runtime permissions |
| Controlled domain and TLS certificate | Required for the recommended HTTPS load-balancer route; Cloud DNS is optional if DNS is elsewhere |
| `gcloud` CLI (optional) | Configure/build/deploy from a terminal instead of the Console |

Enable Cloud Build, Artifact Registry, Cloud Run, and Compute Engine/Load Balancing APIs for the chosen project. Enable Vertex AI only if it is selected in Step 7; enable Secret Manager only when a static external provider key is needed. Product API names and roles can change; confirm the project Console prompts before deploying.

## Actions

1. **Choose the hosting need.** If developers/presenters can run Compose locally, stop at Step 5. Use GCP only when an internet-shareable demo is needed.
2. **Create/select an isolated project.** In Google Cloud Console, choose a project and region, enable billing, configure budget alerts, and enable only needed APIs. Budget alerts notify; they do not cap usage.
3. **Configure identities and permissions.** Use an individual deployer identity with deployment permissions and separate least-privilege service identities. Do not download or embed service-account keys in images.
4. **Create an Artifact Registry repository.** Use a repository in the same region as the Cloud Run services where practical. Tag images with release identifiers; deploy immutable digests for repeatable rollback.
5. **Build and publish both images.** Configure Cloud Build or use local Docker and push to Artifact Registry. Keep source-reviewed records bundled/read-only with the API image or delivered as static app files; do not create a database for R1.
6. **Deploy `api`.** Configure port, concurrency/instance limits, health/metrics behavior, region, and provider variables. If using an HTTPS load balancer, set Cloud Run ingress to `internal-and-cloud-load-balancing`; allow anonymous invocation only through that controlled path so no account is needed.
7. **Deploy `web`.** Configure Nginx to serve the SPA assets. Preserve browser requests to relative `/api` paths so the browser stays on one origin.
8. **Build the HTTPS routing path.** Create a serverless NEG per Cloud Run backend in the matching region, add backend services, configure URL-map paths (`/api/*` to API; default to web), then attach the frontend proxy, certificate, and forwarding rule. Point the chosen domain to the load balancer; Cloud DNS can manage records or the existing DNS provider can.
9. **Verify access boundaries.** Confirm the shared domain serves both frontend and API. Confirm direct `run.app` URLs are blocked by ingress. Check only intended API routes are reachable and no provider secret is exposed in browser assets.
10. **Write a deploy/rollback/reset note.** Record project ID, region, image digests, URL-map routes, service identities, deploy commands/steps, and how to disable/delete resources after the demo. Store no secrets in the note.

## Deliverables

- Cloud Build configuration or repeatable local build/push instructions.
- Artifact Registry repository and two versioned Cloud Run deployments.
- HTTPS load balancer, serverless NEGs, URL map, domain, and certificate configuration.
- Deployment identity/permissions and cost-notification checklist.

## Completion checks

- A user with no account can access the demo through one HTTPS hostname.
- Web and API remain separate Cloud Run services behind path-based routing.
- Direct service URLs are denied by the Cloud Run ingress configuration.
- The selected image digest can be redeployed or rolled back.
- Billing budget notifications and resource deletion/reset steps are documented.
- Local Compose remains available and does not require GCP credentials.

## Official references

- [Cloud Run with external Application Load Balancer](https://docs.cloud.google.com/load-balancing/docs/https/setting-up-reg-ext-https-serverless)
- [Cloud Run ingress controls](https://docs.cloud.google.com/run/docs/securing/ingress)
- [Build images with Cloud Build and Artifact Registry](https://docs.cloud.google.com/build/docs/building/build-containers)

## Handoff

Proceed to [Step 7](step-07-cloud-model-and-operations.md) only if a hosted model and cloud operations are needed. Then complete [Step 9](step-09-acceptance-and-rehearsal.md); Step 8 is a local frontend feature and may be built independently.
