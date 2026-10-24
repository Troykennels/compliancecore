"""Inspect the rendered PDF, independent of the PDFKit layout implementation."""
from pathlib import Path
import json
import pymupdf

folder=Path(__file__).resolve().parents[2]/'verification'/'ci-presentation-20261024'
results=[]
for file in folder.glob('invoice-*.pdf'):
    doc=pymupdf.open(file)
    text='\n'.join(p.get_text() for p in doc)
    assert 'Orion Soft Limited' in text, file.name
    assert f'Page {len(doc)} of {len(doc)}' in text, file.name
    assert 'C&I Leasing' in text or 'Example Account' in text, file.name
    for i,page in enumerate(doc):
        spans=[s for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans'] if s['text'].strip()]
        for span in spans:
            x0,y0,x1,y1=span['bbox']
            assert 30<=x0<x1<=page.rect.width-30 and 20<=y0<y1<=page.rect.height-30,(file.name,i,span['text'],'outside page bounds',span['bbox'])
        for a_index,a in enumerate(spans):
            for b in spans[a_index+1:]:
                overlap=pymupdf.Rect(a['bbox']) & pymupdf.Rect(b['bbox'])
                assert overlap.is_empty or overlap.width<0.75 or overlap.height<0.75,(file.name,i,'text overlap',a['text'],b['text'])
    if file.name=='invoice-demo.pdf':
        assert len(doc)==1
        assert '5,000,000.00' in text and '4,800,000.00' in text and '9,800,000.00' in text
        assert 'NOT A PAYMENT REQUEST' in text
        doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).save(folder/'invoice-demo.png')
    if file.name=='invoice-long.pdf':
        assert len(doc)>2
        assert all(f'Service {i}:' in text for i in range(1,66)), 'Missing a service row'
    if file.name=='invoice-void.pdf': assert 'No payment is required' in text
    results.append({'file':file.name,'pages':len(doc),'noTextOverlap':True,'withinPageBounds':True})
assert len(results)>=7
(folder/'invoice-layout-results.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'passed':True,'fixtures':len(results),'pages':sum(r['pages'] for r in results)}))
