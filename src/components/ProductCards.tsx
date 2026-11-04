import { memo } from 'react';
import { FUNCTIONS, type FunctionId } from '../engine/functions';
import type { FixtureId } from '../scenes';
import type { Favorite } from '../App';

export interface Product {
  id: number;
  name: string;
  price: number | null;
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
};

export const ProductCards = memo(function ProductCards({ data, fixture, fixtureName, functionId, favorite }: Props) {
  if (!data) return null;
  const list = data[fixture].filter((p) => p.functions.includes(functionId));
  const fn = FUNCTIONS[functionId];
  return (
    <section className="products" aria-label="推薦商品">
      {favorite && (
        <div className="favorite" role="status">
          <span className="fav-k">你剛剛最常停在</span>
          <b>
            {favorite.label}
          </b>
          <span className="fav-k">→ 推薦選購</span>
          <b className="fav-fn">
            {favorite.functionName}
            {fn.colorSelectable ? `・${favorite.label.split(' ')[0]}` : ''}
          </b>
        </div>
      )}
      <div className="products-head">
        <h3>
          喜歡這個功能？有「{fn.name}」的{fixtureName}
        </h3>
        <a href={SHOP[fixture]} target="_blank" rel="noopener">
          看全部 →
        </a>
      </div>
      <p className="products-note">下單時在「{fn.family === '調光型' ? '調光功能' : '功能'}」選「{fn.name}」即可。多為訂製品，請先確認崁孔尺寸。</p>
      <div className="product-row">
        {list.map((p) => (
          <a key={p.id} className="product" href={p.link} target="_blank" rel="noopener">
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
            {p.price !== null && <span className="pprice">NT$ {p.price.toLocaleString()} 起</span>}
          </a>
        ))}
      </div>
    </section>
  );
});
