(function(){
  const KEY='novelara_bookmarks';
  function getBookmarks(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function save(list){localStorage.setItem(KEY,JSON.stringify(list))}
  window.NovelaraBookmarks={
    get:getBookmarks,
    has:id=>getBookmarks().some(x=>x.id===id),
    toggle:item=>{
      const list=getBookmarks(); const i=list.findIndex(x=>x.id===item.id);
      if(i>=0){list.splice(i,1);save(list);return false}
      list.push(item);save(list);return true
    },
    renderButton:(btn,item)=>{
      const sync=()=>{const saved=window.NovelaraBookmarks.has(item.id);btn.textContent=saved?'♥ Tersimpan':'♡ Tambah Bookmark';btn.dataset.saved=saved?'true':'false'};
      btn.addEventListener('click',()=>{window.NovelaraBookmarks.toggle(item);sync()}); sync();
    }
  };
})();