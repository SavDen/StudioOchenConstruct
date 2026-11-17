const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../dist/engine.js'),V=require('../dist/composition-view.js'),Export=require('../dist/standalone-export.js'),context={};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/data.js'),'utf8'),context);const D=context.STUDIO_DATA;
const shell=Buffer.from('<!doctype html><!--STUDIO_BOOTSTRAP-->'+(' '.repeat(1200))).toString('base64');
function project(){const scene=E.generate('Свет знаний',E.createScene({sizing:'native',scale:1}),D).scene;return {type:'composition-project',version:2,scene,memory:V.createCollection(scene,D,E)}}
function payload(svg){return JSON.parse(Buffer.from(svg.match(/<metadata id="studio-interactive-payload">([^<]+)<\/metadata>/)[1],'base64').toString())}
test('standalone export retains exact vector preview and all independent scene snapshots without mutating the project',()=>{
 const input=project(),before=JSON.stringify(input),svg=Export.create(input,D,E,shell),saved=payload(svg);
 assert.equal(saved.shell,shell);assert.deepEqual(saved.project,{...input,scene:E.validateScene(input.scene,D)});assert.equal(JSON.stringify(input),before);
 assert.ok(svg.includes('<g id="studio-vector-preview">'+E.sceneMarkup(input.scene,D)+'</g>'));
 assert.ok(!/<image\b/.test(svg));assert.ok(svg.includes('sandbox'));assert.ok(svg.includes('allow-scripts allow-downloads'));assert.ok(!svg.includes('allow-same-origin'));
});
test('query text and script-like metadata cannot escape SVG or injected bootstrap script',()=>{
 const input=project();input.scene.query='</title><script>throw 1</script> & ]]> Привет';
 const svg=Export.create(input,D,E,shell);assert.equal(payload(svg).project.scene.query,input.scene.query);
 assert.equal([...svg.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g,'').matchAll(/<script>/g)].length,1);assert.ok(svg.includes('&lt;/title&gt;'));
 assert.ok(!Export.scriptJSON(input.scene.query).includes('<'));assert.ok(!Export.scriptJSON('&\u2028\u2029').includes('&'));
});
test('standalone export rejects unknown objects, corrupt colors and missing editor code before generating a file',()=>{
 const input=project();assert.throws(()=>Export.create(input,D,E,''));
 assert.throws(()=>Export.create({...input,scene:{...input.scene,items:[{...input.scene.items[0],assetId:'invented'}]}},D,E,shell));
 assert.throws(()=>Export.create({...input,scene:{...input.scene,palette:'invalid'}},D,E,shell));
});
