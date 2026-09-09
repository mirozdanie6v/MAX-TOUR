import { HttpError } from './booking';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXTERNAL_WEBHOOK_PATHS = new Set(['/api/telegram/webhook', '/api/tilda/webhook']);

export function assertTrustedMutationRequest(request: Request, applicationOrigin: string, path: string) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  if (EXTERNAL_WEBHOOK_PATHS.has(path)) return;

  const origin = request.headers.get('origin')?.trim();
  if (origin && origin !== applicationOrigin) {
    throw new HttpError(403, 'Cross-site mutation request отклонён', 'CROSS_SITE_MUTATION_BLOCKED');
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite === 'cross-site') {
    throw new HttpError(403, 'Cross-site mutation request отклонён', 'CROSS_SITE_MUTATION_BLOCKED');
  }
}
