/** A format check, not an antivirus or full document parser. */
export function matchesFileSignature(bytes:Buffer,mime:string):boolean {
 const hex=bytes.subarray(0,12).toString('hex'),ascii=bytes.subarray(0,1024).toString('utf8');
 if(mime==='application/pdf')return ascii.startsWith('%PDF-');
 if(mime==='image/png')return hex.startsWith('89504e470d0a1a0a');
 if(mime==='image/jpeg')return hex.startsWith('ffd8ff');
 if(mime==='image/gif')return /^GIF8[79]a/.test(ascii);
 if(mime==='image/webp')return ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP';
 if(mime==='image/tiff')return hex.startsWith('49492a00')||hex.startsWith('4d4d002a');
 if(mime==='image/bmp')return ascii.startsWith('BM');
 if(mime.includes('openxmlformats')||mime.includes('opendocument')||mime.includes('zip'))return hex.startsWith('504b0304')||hex.startsWith('504b0506');
 if(['application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint'].includes(mime))return hex.startsWith('d0cf11e0a1b11ae1');
 if(['text/plain','text/csv'].includes(mime))return !bytes.includes(0)&&!/^\s*<(?:!doctype\s+html|html|script|svg)\b/i.test(ascii);
 return true; // Non-preview formats remain forced attachment downloads.
}
