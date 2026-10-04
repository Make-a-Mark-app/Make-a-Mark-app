# Step 6 Share a Private Demo over Tailscale

**Depends on:** Local app and Compose behavior from Steps 1–5.
**Outcome:** Authorized tailnet devices can reach the app over HTTPS; public Funnel access remains disabled.

## Function

Use the machine running the Compose stack as a private demo host. Tailscale Serve provides an HTTPS route to the loopback-bound web container. The Express API stays behind Nginx, Grafana remains loopback-only, and the deployment does not expose a public URL. PR #27 implements this profile.

This selected path needs no Google Cloud project, public domain, load balancer, or cloud billing. Cloud Run can remain a separate optional alternative if public access is later needed.

## Requirements

| Requirement | Purpose |
|---|---|
| Docker with Compose | Builds and runs the separate `make-a-mark-tailnet` project |
| Tailscale client connected to the intended tailnet | Gives the host a private network identity |
| Tailscale Serve and MagicDNS | Provides the HTTPS tailnet route and DNS name |
| Tailnet access policy | Controls which devices and users can reach the host |

## Actions

1. **Prepare local settings.** Run `npm run setup:local` once to create a private `.env` and Grafana password. Keep provider credentials in that ignored file and never in source, image build arguments, or browser variables.
2. **Connect the host to Tailscale.** Confirm the host is signed in to the intended tailnet, has a DNS name, and is covered by the access policy for demo participants.
3. **Start the private deployment.** Run `npm run tailnet:up`. The command builds and health-checks the dedicated Compose project, binds web and Grafana ports to loopback, selects an unused Tailscale HTTPS port, and prints the private URL.
4. **Verify the route and access mode.** Run `npm run tailnet:status`. Confirm the Serve path targets the local web service and Funnel is not configured on that port. Check the URL from an authorized tailnet device and verify it is inaccessible from a device outside the tailnet.
5. **Check service boundaries.** Confirm browser requests reach the API only through Nginx, Grafana is available only from the host loopback address, and the API, Prometheus, Loki, and Alloy publish no host ports.
6. **Run the remote browser suite.** Set `PLAYWRIGHT_BASE_URL` to the HTTPS URL and run `npm run test:e2e:tailnet`. This suite uses the running deployment and does not start or stop Compose.
7. **Stop the deployment.** Run `npm run tailnet:down`. Confirm only the Make a Mark Serve mapping and dedicated Compose services are removed; named observability volumes and other Serve routes remain.

## Deliverables

- `npm run tailnet:up`, `tailnet:status`, and `tailnet:down` commands using the dedicated Compose project.
- Tailnet-only HTTPS through Tailscale Serve, with Funnel disabled.
- A documented setup, access-check, browser-test, and cleanup path.

## Completion checks

- The app and `/api/health` work over the printed HTTPS tailnet URL.
- Authorized tailnet devices can reach the app; devices outside the tailnet cannot.
- Funnel is not enabled and no public endpoint is created.
- Grafana remains loopback-only; API and observability containers have no published host ports.
- Stopping the deployment preserves named observability data and unrelated Tailscale routes.
- The default local Compose profile continues to work without Tailscale or cloud credentials.

## Optional alternative

Use a public cloud deployment only if public access becomes a product requirement. That is a separate plan requiring an approved cloud project, ingress design, domain/TLS, access controls, and billing review; it is not a prerequisite for Steps 7 or 8 in the selected private profile.

## Handoff

Proceed to [Step 7](step-07-kiraai-and-private-operations.md) to configure the optional KiraAI provider and private-demo operations, then complete [Step 8](step-08-acceptance-and-rehearsal.md).
