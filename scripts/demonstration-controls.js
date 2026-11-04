const data=JSON.parse(document.getElementById('dataset').textContent);
for(const item of data.cases){
 const row=document.getElementById('case-'+item.id);
 row.addEventListener('click',event=>{
  const button=event.target.closest('button[data-format],button[data-size]');
  if(!button)return;
  if(button.dataset.format)row.dataset.format=button.dataset.format;
  if(button.dataset.size)row.dataset.size=button.dataset.size;
  const format=row.dataset.format,size=row.dataset.size;
  const output=item.previewOutputs.find(o=>o.format===format&&o.size===size);
  row.querySelectorAll('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.format===format)));
  row.querySelectorAll('[data-size]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.size===size)));
  const img=row.querySelector('img');
  img.src=output.file;
  img.alt=item.query+' — '+data.formats[format]+', набор '+size;
  row.querySelector('.open-svg').href=output.file;
  row.querySelector('.download').href=output.file;
  row.querySelector('.format-caption').textContent=data.formats[format];
  row.querySelector('.source-caption').textContent='SVG · '+size+' · 1:1';
  row.querySelector('.size-name').textContent=size;
  row.querySelector('.principle').textContent=output.principle;
  row.querySelector('.corrections').textContent=output.executionNotes.join(' ');
 });
}
