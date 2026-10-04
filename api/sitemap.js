const SUPABASE_URL='https://ohoyqhxgmbwapfxzlnmq.supabase.co';
const SUPABASE_KEY='sb_publishable_Ji0KuM7oE1cHOHg17gKqCA_eBxBWUby';

module.exports=async function(req,res){
  const origin=(req.headers.host?((req.headers['x-forwarded-proto']||'https')+'://'+req.headers.host):'https://novelara.vercel.app').replace(/\/$/,'');
  try{
    const response=await fetch(SUPABASE_URL+'/rest/v1/novels?select=slug,published_at,chapters(id,chapter_number,published_at,status)&status=eq.published&order=published_at.desc',{
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY}
    });
    if(!response.ok) throw new Error('Supabase request failed');
    const novels=await response.json();
    const urls=[
      {loc:origin+'/',changefreq:'daily',priority:'1.0'},
      {loc:origin+'/novels.html',changefreq:'daily',priority:'0.9'}
    ];
    for(const n of novels){
      urls.push({loc:origin+'/novel.html?slug='+encodeURIComponent(n.slug),lastmod:n.published_at,changefreq:'weekly',priority:'0.8'});
      for(const c of (n.chapters||[]).filter(x=>x.status==='published')){
        urls.push({loc:origin+'/chapter.html?novel='+encodeURIComponent(n.slug)+'&chapter='+c.chapter_number,lastmod:c.published_at||n.published_at,changefreq:'monthly',priority:'0.7'});
      }
    }
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'<url><loc>'+u.loc+'</loc>'+(u.lastmod?'<lastmod>'+new Date(u.lastmod).toISOString()+'</lastmod>':'')+'<changefreq>'+u.changefreq+'</changefreq><priority>'+u.priority+'</priority></url>').join('\n')+'\n</urlset>';
    res.statusCode=200;res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');res.end(xml);
  }catch(e){res.statusCode=500;res.setHeader('Content-Type','text/plain; charset=utf-8');res.end('Sitemap unavailable');}
};