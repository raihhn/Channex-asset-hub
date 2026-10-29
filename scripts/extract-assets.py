"""Read the two authorized sheets, preserving source cells and embedded photo anchors."""
import zipfile, xml.etree.ElementTree as E, posixpath, hashlib, json, re, sys
from pathlib import Path
from collections import Counter
source=Path(sys.argv[1]); root=Path(__file__).resolve().parents[1]
z=zipfile.ZipFile(source)
S='http://schemas.openxmlformats.org/spreadsheetml/2006/main';R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';D='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';A='http://schemas.openxmlformats.org/drawingml/2006/main'
def rels(part):
 p=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
 if p not in z.namelist():return {}
 return {r.attrib['Id']:posixpath.normpath(posixpath.join(posixpath.dirname(part),r.attrib['Target'])) if not r.attrib['Target'].startswith('/') else r.attrib['Target'][1:] for r in E.fromstring(z.read(p)) if r.attrib.get('TargetMode')!='External'}
def text(el):return ''.join(el.itertext()) if el is not None else ''
strings=[''.join(t.text or '' for t in si.iter('{'+S+'}t')) for si in E.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
meta=E.fromstring(z.read('xl/metadata.xml')); vms=meta.find('{'+S+'}valueMetadata')
rich=E.fromstring(z.read('xl/richData/rdrichvalue.xml'));richrels=rels('xl/richData/richValueRel.xml');richlinks=list(E.fromstring(z.read('xl/richData/richValueRel.xml')))
media=root/'.local/asset-media';media.mkdir(parents=True,exist_ok=True)
def photo(path,cell):
 blob=z.read(path);ext=Path(path).suffix.lower();mime={'.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}.get(ext)
 if not mime:return None
 key=hashlib.sha256(blob).hexdigest()+ext
 (media/key).write_bytes(blob)
 return {'key':key,'mimeType':mime,'size':len(blob),'sourceCell':cell}
output=[]
for sh in E.fromstring(z.read('xl/workbook.xml')).find('{'+S+'}sheets'):
 if sh.attrib['name'] not in ['ALL BRAND (Storedev)','ALL BRAND (Gd.Internal)']:continue
 part=rels('xl/workbook.xml')[sh.attrib['{'+R+'}id']];sheet=E.fromstring(z.read(part));pics={};errors=[]
 for c in sheet.iter('{'+S+'}c'):
  if 'vm' not in c.attrib:continue
  try:
   rc=vms[int(c.attrib['vm'])-1].find('{'+S+'}rc');rv=rich[int(rc.attrib['v'])];index=int(list(rv)[0].text);path=richrels[richlinks[index].attrib['{'+R+'}id']]
   ph=photo(path,c.attrib['r'])
   if ph:pics.setdefault(int(re.search(r'\d+',c.attrib['r']).group()),[]).append(ph)
  except (KeyError,IndexError,ValueError) as e:errors.append(c.attrib['r'])
 for drawing in sheet.findall('{'+S+'}drawing'):
  dp=rels(part)[drawing.attrib['{'+R+'}id']];dr=E.fromstring(z.read(dp));drels=rels(dp)
  for anchor in dr:
   fr=anchor.find('{'+D+'}from')
   if fr is None:continue
   row=int(fr.find('{'+D+'}row').text)+1; col=int(fr.find('{'+D+'}col').text)+1
   # Only documentation columns F and AA; never assign decorative images to another field.
   if col not in [6,27]:continue
   for blip in anchor.iter('{'+A+'}blip'):
    rid=blip.attrib.get('{'+R+'}embed');path=drels.get(rid)
    if path:
     ph=photo(path,('F' if col==6 else 'AA')+str(row))
     if ph:pics.setdefault(row,[]).append(ph)
 for row in sheet.find('{'+S+'}sheetData'):
  values={};formulas={};cells={}
  for c in row:
   ref=c.attrib['r'];v=c.find('{'+S+'}v');value=v.text if v is not None else text(c.find('{'+S+'}is'))
   if c.attrib.get('t')=='s' and value:value=strings[int(value)]
   if value is not None and value!='':values[re.sub(r'\d+','',ref)]=value;cells[ref]=value
   f=c.find('{'+S+'}f')
   if f is not None:formulas[ref]=f.text
  rn=int(row.attrib['r'])
  if rn==1 or not values.get('E','').strip():continue
  seen=set();photos=[]
  for p in pics.get(rn,[]):
   if p['key'] not in seen:photos.append(p);seen.add(p['key'])
  output.append({'sheet':sh.attrib['name'],'row':rn,'values':values,'cells':cells,'formulas':formulas,'photos':photos,'photoErrors':[c for c in errors if int(re.search(r'\d+',c).group())==rn]})
result={'sourceName':source.name,'sourceHash':hashlib.sha256(source.read_bytes()).hexdigest(),'rows':output}
(root/'db/imports/assets-storedev-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'rows':len(output),'sheets':dict(Counter(r['sheet'] for r in output)),'rowsWithPhotos':dict(Counter(r['sheet'] for r in output if r['photos'])),'photoReferences':sum(len(r['photos']) for r in output),'failedMappings':sum(len(r['photoErrors']) for r in output)},ensure_ascii=False))
