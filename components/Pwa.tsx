'use client';
import {useEffect,useState} from 'react';
export default function Pwa(){const [prompt,setPrompt]=useState<any>(null);useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});const handler=(e:Event)=>{e.preventDefault();setPrompt(e)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);return prompt?<button className="pwa-install" onClick={async()=>{await prompt.prompt();setPrompt(null)}}>Install iStellify</button>:null}
