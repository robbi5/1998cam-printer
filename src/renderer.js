import './index.css';

import pdfMake from 'pdfmake/build/pdfmake';
import sharp from 'sharp';


pdfMake.fonts = {
  freemono: {
    bold: 'https://cdn.jsdelivr.net/gh/googlefonts/RobotoMono@main/fonts/ttf/RobotoMono-Bold.ttf',
    normal: 'https://cdn.jsdelivr.net/gh/googlefonts/RobotoMono@main/fonts/ttf/RobotoMono-Regular.ttf',
  }
};

function mm2pt(mm) {
  return mm / 25.4 * 72;
}

async function truncateText(text, options) {
  return text;
};

async function shortenDescription(text, options) {
  return text;
};

window.addEventListener('DOMContentLoaded', async () => {
  const printerSelect = document.getElementById('setting-printer');
  const queue = {};

  const cAlert = (msg) => new Promise((resolve) => {
    document.getElementById('dialog').addEventListener('close', (e) => {
      resolve(e.target.returnValue);
    }, { once: true });
    document.getElementById('dialog-message').innerText = msg;
    document.getElementById('dialog').showModal();
  });

  document.getElementById('settings-toggle').addEventListener('click', () => {
    document.getElementById('settings').style.display = document.getElementById('settings').style.display === 'block' ? 'none' : 'block';
  });

  const settings = {
    printer: null,
    printDialog: false
  };

  document.getElementById('setting-print-dialog').addEventListener('change', () => {
    settings.printDialog = !settings.printDialog;
    localStorage.setItem('settings', JSON.stringify(settings));
  });

  printerSelect.addEventListener('change', (e) => {
    settings.printer = printerSelect.value;
    localStorage.setItem('settings', JSON.stringify(settings));
  });

  window.electronAPI.getPrinters().then(({ printers, defaultPrinter }) => {
    printers.forEach(p => printerSelect.add(new Option(p.name, p.deviceId), undefined));
    printerSelect.value = defaultPrinter.deviceId;
    settings.printer = defaultPrinter.deviceId;

    try {
      const restored = JSON.parse(localStorage.getItem('settings'));
      Object.assign(settings, restored);

      printerSelect.value = settings.printer;
      document.getElementById('setting-print-dialog').checked = settings.printDialog;
    } catch {
      // ignore
    }

    document.querySelector('#settings-toggle').disabled = false;
    document.querySelector('#print').disabled = false;
  });

  window.electronAPI.onError(async (event, error) => {
    await cAlert(error);
    document.querySelector('iframe').src = '';
    document.querySelector('iframe').style.display = 'none';
  });
  window.electronAPI.onClear(async (event) => {
    const undo = [];
    for (const [id, item] of Object.entries(queue)) {
      await fetch(item.url, { method: 'DELETE' });

      delete queue[id];
      document.getElementById(id).remove();
      undo.push(id);
    }
    document.querySelector('iframe').src = '';
    document.querySelector('iframe').style.display = 'none';
    localStorage.setItem('queue', JSON.stringify(queue));
    localStorage.setItem('undo', JSON.stringify(undo));
  });

  const printNow = async () => {
    if (!settings.printer) {
      return;
    }

    const content = [];

    for (const [id, item] of Object.entries(queue)) {
      const res = await fetch(item.image_url);
      const resBuffer = await res.buffer();

      const image = sharp(resBuffer).resize({
          width: 640,
          kernel: 'nearest'
        })
        // .withMetadata()
        .toFormat('png')
        .toBuffer();

      // convert image to data uri
      const img = `data:image/png;base64,${image.toString('base64')}`;

      content.push({
        columnGap: 0,
        margins: 0,
        columns: [{
          image: img,
          margin: [mm2pt(5), mm2pt(5)],
          width: mm2pt(200),
          style: 'centerme'
        }],
        pageBreak: 'before'
      });
    }

    if (content.length > 0) {
      delete content[0].pageBreak;
      const pdf = pdfMake.createPdf({
        pageSize: {
          width: mm2pt(216),
          height: mm2pt(120),
        },
        pageOrientation: 'portrait',
        pageMargins: 0,

        defaultStyle: {
          font: 'freemono',
          fontSize: 9,
        },

        content: content,
        
        styles: {
          centerme: {
            alignment: 'center'
          }
        },
      });

      pdf.getDataUrl((res) => {
        document.querySelector('iframe').style.display = 'block';
        document.querySelector('iframe').src = res;
        window.electronAPI.print(res, settings);
      });
    }
  };

  const queueItem = async (item) => {
    const id = item.uuid;

    const itemEl = document.createElement('li');
    itemEl.id = id;

    const img = document.createElement('img');
    img.src = item.image_url;

    const description = document.createElement('small');
    description.innerText = item.timestamp;

    const button = document.createElement('button');
    button.innerText = '🗑';
    button.addEventListener('click', () => {
      item.remove()
      delete queue[id];
      localStorage.setItem('queue', JSON.stringify(queue));
    });

    itemEl.appendChild(button);
    itemEl.appendChild(img);
    itemEl.appendChild(description);

    const tmp = document.getElementById(id);
    if (!tmp || !queue[id]) {
      document.getElementById('queue').insertAdjacentElement('afterbegin', itemEl);
    } else {
      tmp.id = 'deleting';
      tmp.insertAdjacentElement('beforebegin', itemEl);
      tmp.remove();
    }

    queue[id] = item;
    localStorage.setItem('queue', JSON.stringify(queue));
  };

  try {
    const restored = JSON.parse(localStorage.getItem('queue'));
    for (const item of Object.keys(restored)) {
      await queueItem(item);
    }
  } catch {
    // ignore
  }

  document.querySelector('#print').addEventListener('click', () => printNow());

  setInterval(async () => {
    const res = await fetch('https://1998.cam/printqueue/print');
    const json = await res.json();
    
    if (json.status !== 'success') {
      return
    }

    queueItem(json.queueitem);
  }, 10000);

  document.getElementById('undo').addEventListener('click', async () => {
    try {
      const items = JSON.parse(localStorage.getItem('undo'));
      for (const item of items) {
        await queueItem(item);
      }
    } catch (e) {
      await cAlert(e.message);
    }
  });
});