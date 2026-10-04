module.exports=async function(req,res){
  const origin=(req.headers.host?((req.headers['x-forwarded-proto']||'https')+'://'+req.headers.host):'https://novelara.vercel.app').replace(/\/$/,'');
  const body=['User-agent: *','Allow: /','Disallow: /admin/','Disallow: /bookmarks.html','Disallow: /api/','Sitemap: '+origin+'/sitemap.xml',''].join('\n');
  res.statusCode=200;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(body);
};