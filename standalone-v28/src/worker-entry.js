import worker from './worker-r2.js';
import { handleAdminTourMediaApi } from './admin-tour-media-api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mediaAdminResponse = await handleAdminTourMediaApi(request, env, url);
    if (mediaAdminResponse) return mediaAdminResponse;
    return worker.fetch(request, env, ctx);
  },
};
