import worker from './worker-r2.js';
import { handleAdminTourMediaApi } from './admin-tour-media-api.js';
import { polishCityOverviewResponse } from './ai-city-overview-polish-v27.js';
import { guardPrimaryIntentResponse } from './ai-primary-intent-guard-v30.js';
import { guardStickyIntentResponse } from './ai-sticky-intent-v31.js';
import {
  normalizePartyCountRequest,
  servePartyContextGuard,
  injectPartyContextGuard,
} from './ai-party-context-guard-v32.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const partyGuardAsset = servePartyContextGuard(url);
    if (partyGuardAsset) return partyGuardAsset;

    const mediaAdminResponse = await handleAdminTourMediaApi(request, env, url);
    if (mediaAdminResponse) return mediaAdminResponse;

    const normalizedRequest = await normalizePartyCountRequest(request, url);
    const response = await worker.fetch(normalizedRequest, env, ctx);
    const polished = await polishCityOverviewResponse(normalizedRequest, env, url, response);
    const guarded = await guardPrimaryIntentResponse(normalizedRequest, env, url, polished);
    const sticky = await guardStickyIntentResponse(normalizedRequest, env, url, guarded);
    return injectPartyContextGuard(sticky);
  },
};
