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
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) return { saved:false, requiresLogin:true };
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
