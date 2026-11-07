import { track } from '../track';
import { memo } from 'react';
import { FUNCTIONS, type FunctionId } from '../engine/functions';
import type { FixtureId } from '../scenes';
import type { Favorite } from '../App';

export interface Product {
  id: number;
  name: string;
  price: number | null;
  priceNote?: string | null;
  image: string | null;
  link: string;
  functions: FunctionId[];
}
export type ProductData = Record<FixtureId, Product[]>;

interface Props {
  data: ProductData | null;
  fixture: FixtureId;
  fixtureName: string;
  functionId: FunctionId;
  favorite?: Favorite | null;
}

const SHOP: Record<FixtureId, string> = {
  recessed: 'https://www.varilumi.com/product-category/recessed-light/',
  track: 'https://www.varilumi.com/product-category/track-light/',
  ceiling: 'https://www.varilumi.com/product-category/ceiling-light/',
  cove: 'https://www.varilumi.com/product-category/light-strip/',
};

export const ProductCards = memo(function ProductCards({ data, fixture, fixtureName, functionId, favorite }: Props) {
  if (!data) return null;
  const list = data[fixture].filter((p) => p.functions.includes(functionId));
  const fn = FUNCTIONS[functionId];
  return (
    <section className="products" aria-label="推薦商品">
      {favorite && (
        <div className="favorite" role="status">
          <span className="fav-k">依照你的使用習慣，推薦</span>
          <b className="fav-fn">
            {favorite.functionName}
            {fn.colorSelectable ? `・${favorite.label.split(' ')[0]}` : ''}
          </b>
          <button type="button" className="link fav-go" onClick={() => document.getElementById('product-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}>
            查看產品 →
          </button>
          <details className="fav-why">
            <summary>為什麼？</summary>
            你剛剛最常停在 {favorite.label}（約 {favorite.seconds} 秒）。
          </details>
        </div>
      )}
      <div className="products-head">
        <h3>推薦相容燈具</h3>
        <a href={SHOP[fixture]} target="_blank" rel="noopener" onClick={() => track('shop_all_click', { fixture, function: functionId })}>
          看全部 →
        </a>
      </div>
      <p className="products-sub">支援「{fn.name}」的飛利明{fixtureName}</p>
      <p className="products-note">下單時在「{fn.family === '調光型' ? '調光功能' : '功能'}」選「{fn.name}」，需要的話再勾選「加記憶功能」。多為訂製品，請先確認尺寸。</p>
      <div className="product-row" id="product-row">
        {list.map((p) => (
          <a
            key={p.id}
            className="product"
            href={p.link}
            target="_blank"
            rel="noopener"
            onClick={() => track('product_click', { product: p.name.slice(0, 90), fixture, function: functionId })}
          >
            <span className="pimg">{p.image && (
                <img
                  src={p.image}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}</span>
            <span className="pname">{p.name}</span>
            {p.price !== null ? (
              <span className="pprice">NT$ {p.price.toLocaleString()} 起</span>
            ) : (
              p.priceNote && <span className="pprice">{p.priceNote}</span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
});
