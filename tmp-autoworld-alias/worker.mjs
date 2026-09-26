const TARGET='https://auto-sale-demo.viiversion.com';

export default {
  async fetch(request) {
    const incoming=new URL(request.url);
    const target=new URL(TARGET);
    target.pathname=incoming.pathname;
    target.search=incoming.search;

    const headers=new Headers(request.headers);
    headers.set('x-forwarded-host',incoming.host);
    headers.set('x-forwarded-proto','https');

    const init={method:request.method,headers,redirect:'manual'};
    if(request.method!=='GET'&&request.method!=='HEAD')init.body=request.body;

    const upstream=await fetch(new Request(target.toString(),init));
    const outHeaders=new Headers(upstream.headers);

    const location=outHeaders.get('location');
    if(location){
      outHeaders.set('location',location.replaceAll('https://auto-sale-demo.viiversion.com','https://autoworld.viiversion.com'));
    }

    return new Response(upstream.body,{
      status:upstream.status,
      statusText:upstream.statusText,
      headers:outHeaders
    });
  }
};
