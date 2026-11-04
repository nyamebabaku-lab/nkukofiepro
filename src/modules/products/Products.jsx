import { useRef, useState } from 'react';
import { Plus, Pencil, PackagePlus, Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react';
import { useDB } from '../../data/store';
import { useFarmScope, useMyFarms } from '../../data/selectors';
import { PageHeader, Button, Card, Badge, Segmented, FormModal, Modal, Field, Input, Select, IconButton, toast, cx } from '../../components/ui';
import { ProductImage, ART_OPTIONS } from '../../components/ProductArt';
import { PRODUCT_CATEGORIES, UNITS, EGG_SIZES, productStock, categoryLabel } from '../../lib/stock';
import { SPECIES, PURPOSES } from '../../lib/standards';
import { savePhoto, resizeImage } from '../../data/photos';
import { money, num, today } from '../../lib/format';

function Thumb({ p, className }) {
  return <ProductImage p={p} className={className} />;
}

function PhotoPicker({ product }) {
  const ref = useRef();
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await resizeImage(f);
    await savePhoto(`product:${product.id}`, url);
    useDB.getState().update('products', product.id, { hasPhoto: true });
    toast.success('Photo saved');
  };
  return (
    <div className="flex items-center gap-3">
      <Thumb p={product} className="h-20 w-20" />
      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="secondary" icon={ImagePlus} onClick={() => ref.current.click()}>{product.hasPhoto ? 'Change photo' : 'Upload photo'}</Button>
        {product.hasPhoto && <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { await savePhoto(`product:${product.id}`, null); useDB.getState().update('products', product.id, { hasPhoto: false }); }}>Use illustration</Button>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}

export default function Products() {
  const db = useDB();
  const scope = useFarmScope();
  const farms = useMyFarms();
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState(null);
  const [stockFor, setStockFor] = useState(null);
  const [stock, setStock] = useState({});
  const list = db.products.filter((p) => (cat === 'all' || p.category === cat) && (scope === 'all' || p.farmIds.includes(scope)));

  const fields = [
    { name: 'name', label: 'Product name', required: true, span: 2 },
    { name: 'category', label: 'Category', type: 'select', options: PRODUCT_CATEGORIES, required: true },
    { name: 'unit', label: 'Sold per', type: 'select', options: UNITS, required: true },
    { name: 'price', label: 'Price (GH₵)', type: 'number', step: '0.01', required: true },
    { name: 'stockMode', label: 'Stock comes from', type: 'select', required: true, options: [{ value: 'manual', label: 'Stock I add by hand' }, { value: 'eggs', label: 'Egg collection records' }, { value: 'birds', label: 'Live birds in flocks' }] },
    { name: 'wholesalePrice', label: 'Wholesale price (GH₵)', type: 'number', step: '0.01' },
    { name: 'wholesaleMin', label: 'Wholesale from (qty)', type: 'number' },
    { name: 'eggSize', label: 'Egg size', type: 'select', options: EGG_SIZES, hidden: (v) => v.stockMode !== 'eggs' },
    { name: 'eggsPer', label: 'Eggs per unit', type: 'number', hidden: (v) => v.stockMode !== 'eggs' },
    { name: 'species', label: 'Bird', type: 'select', options: SPECIES, hidden: (v) => v.stockMode !== 'birds' },
    { name: 'purpose', label: 'From flocks kept for', type: 'select', options: PURPOSES, hidden: (v) => v.stockMode !== 'birds' },
    { name: 'art', label: 'Picture style', type: 'select', options: ART_OPTIONS },
    { name: 'farmIds', label: 'Sold at', type: 'custom', span: 2, render: (v, set) => (
      <div className="flex flex-wrap gap-2">
        {db.farms.map((f) => {
          const on = (v.farmIds || []).includes(f.id);
          return <button key={f.id} type="button" onClick={() => set(on ? v.farmIds.filter((x) => x !== f.id) : [...(v.farmIds || []), f.id])} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold ring-1', on ? 'bg-brand-700 text-white ring-brand-700' : 'ring-cream-300 text-slate-600 dark:ring-white/10 dark:text-slate-300')}>{f.name}</button>;
        })}
      </div>
    ) },
    { name: 'description', label: 'Description (shown to customers)', type: 'textarea' },
    { name: 'onPortal', label: 'Show in the customer shop', type: 'checkbox' },
  ];
  const save = (v) => {
    const s = useDB.getState();
    const data = { ...v, price: +v.price, wholesalePrice: v.wholesalePrice ? +v.wholesalePrice : null, wholesaleMin: v.wholesaleMin ? +v.wholesaleMin : null, eggsPer: v.eggsPer ? +v.eggsPer : 30, farmIds: v.farmIds?.length ? v.farmIds : farms.map((f) => f.id) };
    if (v.id) s.update('products', v.id, data);
    else s.add('products', { ...data, active: true });
    if (v.id && v.price !== db.products.find((p) => p.id === v.id)?.price) s.log('Price changed', `${v.name} → ${money(v.price)}`);
    toast.success(v.id ? 'Product updated' : 'Product added');
    setEdit(null);
  };
  const addStock = () => {
    const q = +stock.qty;
    if (!q) return toast.error('Enter a quantity');
    db.add('productMoves', { productId: stockFor.id, farmId: stock.farmId, date: today(), qty: q, kind: q > 0 ? 'in' : 'adjust', note: stock.note || (q > 0 ? 'Stock added' : 'Adjustment') });
    toast.success('Stock updated', `${q > 0 ? '+' : ''}${q} ${stockFor.unit}`);
    setStockFor(null);
    return null;
  };

  return (
    <div>
      <PageHeader title="Products & prices" subtitle="What customers can buy, at what price, and how much is available" actions={<Button icon={Plus} onClick={() => setEdit({ category: 'other', unit: 'piece', stockMode: 'manual', onPortal: true, art: 'crate', farmIds: farms.map((f) => f.id) })}>New product</Button>} />
      <Segmented className="mb-5 flex-wrap" options={[{ value: 'all', label: 'All' }, ...PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]} value={cat} onChange={setCat} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((p) => {
          const st = productStock(db, p.id, scope);
          return (
            <Card key={p.id} className={cx('flex flex-col overflow-hidden', !p.onPortal && 'opacity-70')}>
              <div className="relative">
                <Thumb p={p} className="aspect-[4/3] w-full" />
                <div className="absolute left-3 top-3 flex gap-1.5"><Badge tone="slate" className="bg-white/90 dark:bg-navy-900/90">{categoryLabel(p.category)}</Badge>{!p.onPortal && <Badge tone="red">Hidden</Badge>}</div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                <p className="mt-0.5 text-lg font-extrabold text-brand-800 dark:text-gold-400">{money(p.price)} <span className="text-xs font-semibold text-slate-400">/ {p.unit}</span></p>
                {p.wholesalePrice && <p className="text-xs text-slate-500">Wholesale {money(p.wholesalePrice)} from {num(p.wholesaleMin)}</p>}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-cream-100 px-3 py-2 text-xs dark:bg-white/5">
                  <span className="text-slate-500">{p.stockMode === 'eggs' ? 'From egg records' : p.stockMode === 'birds' ? 'From live flocks' : 'Stock'}</span>
                  <span className={cx('font-bold', st.available ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-600')}>{num(st.available)} available{st.reserved ? ` · ${num(st.reserved)} booked` : ''}</span>
                </div>
                <div className="mt-auto flex gap-1 pt-3">
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEdit(p)}>Edit</Button>
                  {p.stockMode === 'manual' && <Button size="sm" variant="soft" icon={PackagePlus} onClick={() => { setStockFor(p); setStock({ farmId: scope === 'all' ? p.farmIds[0] : scope, qty: '' }); }}>Stock</Button>}
                  <IconButton className="ml-auto" icon={p.onPortal ? Eye : EyeOff} label={p.onPortal ? 'Hide from shop' : 'Show in shop'} onClick={() => db.update('products', p.id, { onPortal: !p.onPortal })} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit product' : 'New product'} fields={edit?.id ? [{ name: '_photo', label: 'Photo', type: 'custom', span: 2, render: () => <PhotoPicker product={db.products.find((x) => x.id === edit.id)} /> }, ...fields] : fields} initial={edit} onSubmit={save} />
      <Modal open={!!stockFor} onClose={() => setStockFor(null)} title={`Stock · ${stockFor?.name}`} subtitle="Use a minus number to remove (e.g. damaged)" size="sm" footer={<Button onClick={addStock}>Save</Button>}>
        <div className="space-y-4">
          <Field label="Farm"><Select value={stock.farmId || ''} onChange={(e) => setStock({ ...stock, farmId: e.target.value })} options={db.farms.filter((f) => stockFor?.farmIds.includes(f.id)).map((f) => ({ value: f.id, label: `${f.name} · ${num(productStock(db, stockFor?.id, f.id).available)} now` }))} /></Field>
          <Field label={`Quantity (${stockFor?.unit})`}><Input inputMode="numeric" value={stock.qty} onChange={(e) => setStock({ ...stock, qty: e.target.value })} /></Field>
          <Field label="Note"><Input value={stock.note || ''} onChange={(e) => setStock({ ...stock, note: e.target.value })} placeholder="e.g. processed 40 birds" /></Field>
        </div>
      </Modal>
    </div>
  );
}
