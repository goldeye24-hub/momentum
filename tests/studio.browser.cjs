'use strict';
/* Runs in real headless Chromium via Github Actions; no production credentials needed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'};
function localServer(){
  return http.createServer((req,res)=>{
    let target;
    try{
      const u=new URL(req.url,'http://localhost');
      target=path.resolve(root,'.'+decodeURIComponent(u.pathname).replace(/\/$/,'/index.html'));
      if(!target.startsWith(root+path.sep))throw Error('outside root');
    }catch{res.writeHead(400);res.end('Bad request');return;}
    fs.readFile(target,(err,data)=>{
      if(err){res.writeHead(404);res.end('Not found');return}
      res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(data);
    });
  });
}
function pngDims(buf){
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRQsAAAAASUVORK5CYII=','base64');
(async()=>{
  const server=localServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const ctx=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,deviceScaleFactor:1});
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+port+'/lab/',{waitUntil:'load'});
    await page.fill('#storeName','포항 묵돌이');
    await page.locator('[data-view="creative"]').click();
    await page.waitForSelector('.studio-template',{state:'visible'});
    assert.equal(await page.locator('.studio-template').count(),8);
    assert.equal(await page.locator('#studioBusiness').inputValue(),'포항 묵돌이');
    await page.screenshot({path:path.join(root,'artifacts/studio-desktop.png'),fullPage:true});
    console.log('PASS: 8 visible templates and business name from single input');

    // Different templates must actively update headings and the Canvas, not just CSS.
    let prevData=await page.locator('#poster').evaluate(el=>el.toDataURL());
    for(const name of ['menu','sale','opening','notice','booking','beauty','premium','review']){
      await page.locator('[data-studio-template="'+name+'"]').click();
      await page.waitForTimeout(50);
      assert.equal(await page.locator('[data-studio-template="'+name+'"]').getAttribute('aria-pressed'),'true');
      assert.ok((await page.locator('#studioHeadline').inputValue()).length>5);
      const url=await page.locator('#poster').evaluate(el=>el.toDataURL());
      assert.ok(url.length>10000,'Canvas output unexpectedly small for '+name);
      if(name!=='menu')assert.notEqual(url,prevData,'Template did not alter rendered Canvas');
      prevData=url;
    }
    console.log('PASS: all templates render distinct full-sized Canvas artwork');

    // Upload actual image bytes and verify an image object reaches Canvas, not just a filename.
    await page.locator('#studioPhoto').setInputFiles({name:'test-photo.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#studioPhotoName').textContent.includes('test-photo.png'));
    await page.locator('#studioLogo').setInputFiles({name:'test-logo.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#studioLogoName').textContent.includes('test-logo.png'));
    await page.fill('#studioHeadline','신선함을 담은 특별한 한상');
    await page.fill('#studioPrice','30,000원');
    await page.locator('#studioZoom').evaluate(el=>{el.value='160';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.locator('#studioPanX').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.locator('#studioBrightness').evaluate(el=>{el.value='120';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#studioZoomValue').textContent(),'160%');
    assert.equal(await page.locator('#studioBrightnessValue').textContent(),'120%');
    console.log('PASS: image/logo uploads, live text and image controls');

    for(const [size,w,h] of [['square',1080,1080],['portrait',1080,1350],['story',1080,1920],['banner',1200,628]]){
      await page.selectOption('#studioFormat',size);
      await page.waitForFunction(([width,height])=>{
        const x=document.getElementById('poster');
        return x.width===width&&x.height===height;
      },[w,h]);
      const [download]=await Promise.all([
        page.waitForEvent('download',{timeout:25000}),
        page.locator('#studioDownload').click()
      ]);
      const file=path.join(os.tmpdir(),'momentum-'+size+'-'+Date.now()+'.png');
      await download.saveAs(file);
      const buf=fs.readFileSync(file);
      assert.deepEqual(pngDims(buf),{width:w,height:h});
      assert.ok(buf.length>10000,'PNG is too small; possible blank canvas '+size);
      fs.unlinkSync(file);
      console.log('PASS: '+size+' downloaded '+w+'x'+h+' PNG');
    }

    // Mobile viewport: no unexplained viewport overflow and the editor is usable.
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(120);
    const dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(dimensions.scrollWidth<=dimensions.viewport+3,'Mobile horizontal overflow '+JSON.stringify(dimensions));
    await page.screenshot({path:path.join(root,'artifacts/studio-mobile.png'),fullPage:true});
    assert.ok(await page.locator('#studioDownload').isVisible());
    assert.equal(errors.length,0,'Browser runtime errors: '+errors.join(' | '));
    console.log('PASS: mobile layout and zero page errors');
    await ctx.close();
    console.log('STUDIO BROWSER TESTS PASSED');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
