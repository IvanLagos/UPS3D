/* Fotos de referencia: se cargan desde el equipo, se ven en miniatura y pueden colocarse como placa en la puerta frontal. */
import * as THREE from 'three';
import { $ } from '../core/dom.js';
import { toast } from '../core/interaction.js';
import { photoPlane } from '../model/doors.js';

const photos = [];

function usePhoto(p) {
  new THREE.TextureLoader().load(p.url, tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const ar = tex.image.height / tex.image.width;
    const w = Math.min(0.4, 0.12 / ar), h = w * ar;
    photoPlane.geometry.dispose();
    photoPlane.geometry = new THREE.PlaneGeometry(w, h);
    photoPlane.material.map = tex; photoPlane.material.needsUpdate = true;
    photoPlane.visible = true;
    toast('Foto colocada en la puerta frontal.');
  });
}

function renderThumbs() {
  const wrap = $('#thumbs'); wrap.innerHTML = '';
  for (const p of photos) {
    const d = document.createElement('div'); d.className = 'thumb';
    d.innerHTML = `<img src="${p.url}" alt=""><button>Usar en puerta</button>`;
    d.querySelector('img').onclick = () => { $('#lightbox img').src = p.url; $('#lightbox').style.display = 'flex'; };
    d.querySelector('button').onclick = () => usePhoto(p);
    wrap.appendChild(d);
  }
}

export function initPhotos() {
  $('#btnPhoto').onclick = () => $('#photoIn').click();
  $('#photoIn').onchange = e => {
    for (const f of e.target.files) photos.push({ url: URL.createObjectURL(f), name: f.name });
    e.target.value = ''; renderThumbs();
  };
  $('#lightbox').onclick = () => { $('#lightbox').style.display = 'none'; };
}
