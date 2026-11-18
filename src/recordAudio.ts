/** User-initiated Windows loopback capture; no TikTok downloading or page scraping. */
export async function recordPlayingAudio(tiktokUrl:string):Promise<Uint8Array>{
 if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('У цій збірці недоступне захоплення системного звуку');
 await window.lifehub.armAudioCapture();
 let stream:MediaStream|null=null;
 let activeRecorder:MediaRecorder|null=null;
 try{
  stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
  const audioTracks=stream.getAudioTracks();
  if(!audioTracks.length)throw new Error('Windows не передав системний звук. Спробуй увімкнути дозвіл або вибрати файл');
  const mime=['audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime)throw new Error('У цій версії немає підтримки запису WebM/Opus');
  const audio=new MediaStream(audioTracks);
  const recorder=new MediaRecorder(audio,{mimeType:mime,audioBitsPerSecond:96000});
  activeRecorder=recorder;
  const chunks:Blob[]=[];
  const recorded=new Promise<Uint8Array>((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>reject(new Error('Помилка запису звуку'));
   recorder.onstop=()=>{new Blob(chunks,{type:mime}).arrayBuffer().then(b=>resolve(new Uint8Array(b)),reject);};
  });
  recorder.start(1000);
  // TikTok opens only after the local audio capture is active.
  // If autoplay is blocked, the user presses Play in the browser.
  await window.lifehub.openLink(tiktokUrl);
  await new Promise(resolve=>setTimeout(resolve,16000));
  if(recorder.state!=='inactive')recorder.stop();
  const bytes=await recorded;
  if(bytes.byteLength<1000)throw new Error('Звуку не записано — перевір, що TikTok відтворювався');
  return bytes;
 }finally{if(activeRecorder && activeRecorder.state!=='inactive')activeRecorder.stop();stream?.getTracks().forEach(t=>t.stop());}
}
