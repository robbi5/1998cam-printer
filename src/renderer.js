import './index.css';

import QRCode from 'qrcode';
import logo from './logo.svg';
import pdfMake from 'pdfmake/build/pdfmake';

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
    document.querySelector('#print-small').disabled = false;
    document.querySelector('#print').disabled = false;
  });

  window.electronAPI.onError(async (event, error) => {
    await cAlert(error);
    document.querySelector('iframe').src = '';
    document.querySelector('iframe').style.display = 'none';
  });
  window.electronAPI.onClear((event, small) => {
    const undo = [];
    for (const [id, item] of Object.entries(queue)) {
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
    const small = false;
    if (!settings.printer) {
      return;
    }

    const content = [];

    for (const [id, item] of Object.entries(queue)) {
      const svg = await new Promise((resolve, reject) => QRCode.toString(id, {
        version: 1,
        margin: 0,
        type: 'svg',
        mode: 'alphanumeric',
        errorCorrectionLevel: 'Q'
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }));

      content.push({
        columnGap: mm2pt(.5),
        margins: 0,
        columns: small ? [{
          svg: svg,
          width: mm2pt(10),
          margin: [mm2pt(0), mm2pt(1), mm2pt(3), mm2pt(1)],
        }, {
          width: '*',
          margin: [mm2pt(1), mm2pt(.3), mm2pt(1), mm2pt(3)],
          stack: [{
            bold: true,
            fontSize: 7,
            text: id.toUpperCase(),
            margin: [mm2pt(0), mm2pt(0), mm2pt(0), mm2pt(.1)]
          }, {
            text: await truncateText(item.title, { fontSize: 6, maxWidth: mm2pt(50 - 10 - 7.5 - 3) }),
            fontSize: 6,
            margin: [mm2pt(0), mm2pt(0), mm2pt(0), mm2pt(.1)],
          }, {
            text: await shortenDescription(item.yaml?.description || '', { fontSize: 6, maxWidth: mm2pt(50 - 10 - 7.5 - 3), maxLines: 2 }),
            lineHeight: .8,
            fontSize: 6
          }]
        }, {
          svg: logo,
          margin: [mm2pt(0), mm2pt(1)],
          width: mm2pt(7.5)
        }] : [{
          svg: svg,
          width: mm2pt(18),
          margin: [mm2pt(0), mm2pt(3), mm2pt(3), mm2pt(3)],
        }, {
          width: '*',
          margin: [mm2pt(3), mm2pt(1.7), mm2pt(2), mm2pt(3)],
          stack: [{
            bold: true,
            fontSize: 11,
            text: id.toUpperCase(),
            margin: [mm2pt(0), mm2pt(0), mm2pt(0), mm2pt(.5)]
          }, {
            fontSize: 9,
            text: await truncateText(item.title, { fontSize: 9, maxWidth: mm2pt(90 - 18 - 13.45 - 2) }),
            margin: [mm2pt(0), mm2pt(0), mm2pt(0), mm2pt(.5)],
          }, {
            text: await shortenDescription(item.yaml?.description || '', { fontSize: 8, maxWidth: mm2pt(90 - 18 - 13.45 - 2), maxLines: 3 }),
            lineHeight: .8,
            fontSize: 8
          }]
        }, {
          svg: logo,
          margin: [mm2pt(0), mm2pt(3)],
          width: mm2pt(13.45)
        }],
        pageBreak: 'before'
      });
    }

    if (content.length > 0) {
      delete content[0].pageBreak;
      const pdf = pdfMake.createPdf({
        pageSize: {
          width: small ? mm2pt(50) : mm2pt(95),
          height: small ? mm2pt(12) : mm2pt(24)
        },
        pageOrientation: 'landscape',
        pageMargins: 0,

        defaultStyle: {
          font: 'freemono',
          fontSize: 9,
        },

        content: content
      });

      pdf.getDataUrl((res) => {
        document.querySelector('iframe').style.display = 'block';
        document.querySelector('iframe').src = res;
        window.electronAPI.print(res, settings, small);
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

    item.appendChild(button);
    item.appendChild(img);
    item.appendChild(description);

    const tmp = document.getElementById(id);
    if (!tmp || !queue[id]) {
      document.getElementById('queue').insertAdjacentElement('afterbegin', item);
    } else {
      tmp.id = 'deleting';
      tmp.insertAdjacentElement('beforebegin', item);
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