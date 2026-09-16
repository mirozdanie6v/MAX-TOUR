import worker from './worker-r2.js';
import { handleAdminTourMediaApi } from './admin-tour-media-api.js';
import { polishCityOverviewResponse } from './ai-city-overview-polish-v27.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mediaAdminResponse = await handleAdminTourMediaApi(request, env, url);
    if (mediaAdminResponse) return mediaAdminResponse;
    const response = await worker.fetch(request, env, ctx);
    return polishCityOverviewResponse(request, env, url, response);
  },
};
