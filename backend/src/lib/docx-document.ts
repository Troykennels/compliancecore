import archiver from 'archiver';
import type { Response } from 'express';
const xml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function downloadTextDocument(t:{id:string;title:string;content:string},res:Response):boolean {
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition',`attachment; filename="${t.id}-template.docx"`);
 const zip=archiver('zip',{zlib:{level:6}});zip.on('error',()=>res.destroy());zip.pipe(res);
 zip.append('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',{name:'[Content_Types].xml'});
 zip.append('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',{name:'_rels/.rels'});
 const paragraphs=[t.title,...t.content.split('\n')].map((line,i)=>`<w:p>${i===0?'<w:pPr><w:spacing w:after="240"/></w:pPr>':''}<w:r>${i===0?'<w:rPr><w:b/><w:sz w:val="32"/></w:rPr>':''}<w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join('');
 zip.append(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,{name:'word/document.xml'});
 void zip.finalize();return true;
}
