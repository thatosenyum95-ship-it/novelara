import { supabase } from './supabase.js';

export async function getPublishedNovels() {
  const { data, error } = await supabase
    .from('novels')
    .select('id,title,slug,author_name,synopsis,cover_url,status,published_at,views,followers_count,novel_genres(genre:genres(name,slug))')
    .eq('status','published')
    .order('published_at',{ascending:false});
  if (error) throw error;
  return data || [];
}

export async function getNovelBySlug(slug) {
  const { data, error } = await supabase
    .from('novels')
    .select('id,title,slug,author_name,synopsis,cover_url,status,published_at,views,followers_count,novel_genres(genre:genres(name,slug)),chapters(id,chapter_number,title,published_at,status)')
    .eq('slug',slug)
    .eq('status','published')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  data.chapters=(data.chapters||[]).filter(c=>c.status==='published').sort((a,b)=>a.chapter_number-b.chapter_number);
  return data;
}

export async function getChapterById(id) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id,novel_id,chapter_number,title,content,published_at,novel:novels(id,title,slug,author_name,status)')
    .eq('id',id).eq('status','published').maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChapter(novelSlug, chapterNumber) {
  const novel = await getNovelBySlug(novelSlug);
  if (!novel) return null;
  const chapter = novel.chapters.find(c=>c.chapter_number===Number(chapterNumber));
  if (!chapter) return null;
  const { data, error } = await supabase.from('chapters')
    .select('id,novel_id,chapter_number,title,content,published_at')
    .eq('id',chapter.id).maybeSingle();
  if (error) throw error;
  return { novel, chapter:data };
}

export async function getEnabledAds(position) {
  const { data, error } = await supabase
    .from('ad_settings')
    .select('id,name,position,enabled,ad_code')
    .eq('enabled', true)
    .eq('position', position)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function renderAd(element, position) {
  if (!element) return;
  try {
    const ad = await getEnabledAds(position);
    if (!ad?.ad_code?.trim()) {
      element.hidden = true;
      return;
    }
    element.hidden = false;
    element.innerHTML = '';
    const template = document.createElement('template');
    template.innerHTML = ad.ad_code.trim();
    for (const node of [...template.content.childNodes]) {
      if (node.nodeName.toLowerCase() !== 'script') element.appendChild(node.cloneNode(true));
    }
    for (const oldScript of [...template.content.querySelectorAll('script')]) {
      const script = document.createElement('script');
      for (const attr of oldScript.attributes) script.setAttribute(attr.name, attr.value);
      if (oldScript.textContent) script.textContent = oldScript.textContent;
      element.appendChild(script);
    }
  } catch (error) {
    console.error('Gagal memuat iklan', position, error);
    element.hidden = true;
  }
}

function getVisitorId(){
  const key='novelara_visitor_id';
  let id=localStorage.getItem(key);
  if(!id){ id=crypto.randomUUID ? crypto.randomUUID() : 'v_'+Date.now()+'_'+Math.random().toString(36).slice(2); localStorage.setItem(key,id); }
  return id;
}

export async function getNovelSocial(novelId){
  const [{data:likes,error:likeError},{data:comments,error:commentError}]=await Promise.all([
    supabase.from('novel_likes').select('visitor_id').eq('novel_id',novelId),
    supabase.from('comments').select('id,content,display_name,created_at').eq('novel_id',novelId).order('created_at',{ascending:false})
  ]);
  if(likeError) throw likeError; if(commentError) throw commentError;
  const visitorId=getVisitorId();
  return {likeCount:likes?.length||0,liked:!!likes?.some(x=>x.visitor_id===visitorId),comments:comments||[]};
}

export async function toggleNovelLike(novelId){
  const visitorId=getVisitorId();
  const {data:existing,error:checkError}=await supabase.from('novel_likes').select('novel_id').eq('novel_id',novelId).eq('visitor_id',visitorId).maybeSingle();
  if(checkError) throw checkError;
  if(existing){ const {error}=await supabase.from('novel_likes').delete().eq('novel_id',novelId).eq('visitor_id',visitorId); if(error) throw error; return false; }
  const {error}=await supabase.from('novel_likes').insert({novel_id:novelId,visitor_id:visitorId});
  if(error) throw error;
  return true;
}

export async function addNovelComment(novelId,content,displayName){
  const clean=String(content||'').trim().slice(0,1000);
  const name=String(displayName||'Pembaca').trim().slice(0,60)||'Pembaca';
  if(!clean) throw new Error('Komentar masih kosong.');
  const {data,error}=await supabase.from('comments').insert({novel_id:novelId,user_id:null,content:clean,display_name:name}).select('id,content,display_name,created_at').single();
  if(error) throw error;
  return data;
}

export function novelCard(n) {
  const genres=(n.novel_genres||[]).map(x=>x.genre).filter(Boolean);
  const tags=genres.slice(0,2).map(g=>'<span class="card-tag">'+escapeHtml(g.name)+'</span>').join('');
  const coverClass=genres[0]?.slug==='office-romance'?'alt1':genres[0]?.slug==='marriage-story'?'alt2':genres[0]?.slug==='teen-romance'?'alt3':'';
  return '<article class="novel-card" data-title="'+escapeAttr(n.title)+'" data-author="'+escapeAttr(n.author_name||'')+'" data-genres="'+escapeAttr(genres.map(g=>g.name).join(','))+'">'+
    '<a href="novel.html?slug='+encodeURIComponent(n.slug)+'" aria-label="'+escapeAttr(n.title)+'"><div class="cover '+coverClass+'"'+(n.cover_url?' style="background-image:url(\''+escapeAttr(n.cover_url)+'\');background-size:cover;background-position:center;"':'')+'><small>Novelara Original</small><strong>'+escapeHtml(n.title)+'</strong></div></a>'+
    '<div class="card-body"><h2>'+escapeHtml(n.title)+'</h2><div class="author">'+escapeHtml(n.author_name||'Novelara')+'</div><div class="card-tags">'+tags+'</div><div class="card-foot"><span>Novel</span><span>'+(n.views||0)+' pembaca</span></div></div></article>';
}

export function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function escapeAttr(v=''){return escapeHtml(v);}

export async function bookmarkNovel(novel) {
  let { data:{user} } = await supabase.auth.getUser();
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { saved:false, requiresLogin:false, error:error.message };
    user = data.user;
  }
  const { data:existing } = await supabase.from('bookmarks').select('novel_id').eq('user_id',user.id).eq('novel_id',novel.id).maybeSingle();
  if (existing) {
    const { error }=await supabase.from('bookmarks').delete().eq('user_id',user.id).eq('novel_id',novel.id);
    if(error) throw error;
    return {saved:false};
  }
  const { error }=await supabase.from('bookmarks').insert({user_id:user.id,novel_id:novel.id});
  if(error) throw error;
  return {saved:true};
}

export async function isBookmarked(novelId) {
  const { data:{user} }=await supabase.auth.getUser();
  if(!user) return false;
  const {data}=await supabase.from('bookmarks').select('novel_id').eq('user_id',user.id).eq('novel_id',novelId).maybeSingle();
  return !!data;
}
