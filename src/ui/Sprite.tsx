import { findAsset } from '../assets/manifest';
import { getAssetUrl } from '../assets/resolve';

interface SpriteProps {
  assetId: string;
  className?: string;
  /** Aplica o filtro de "eco" (silhueta sombria) sobre o sprite. */
  echo?: boolean;
}

/** Matiz estável derivada do id, para placeholders visualmente distintos. */
function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash;
}

/**
 * Exibe um asset do manifesto. Enquanto o PNG não for entregue, renderiza
 * um placeholder identificado com o id do asset — o jogo é totalmente
 * jogável antes da arte existir e cada lacuna fica evidente na tela.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function Sprite({ assetId, className = '', echo = false }: SpriteProps) {
  const asset = findAsset(assetId);
  const url = getAssetUrl(assetId);
  const classes = `sprite ${echo ? 'sprite--echo' : ''} ${className}`.trim();
  if (url) {
    return <img className={classes} src={url} alt={asset?.title ?? assetId} draggable={false} />;
  }
  return (
    <div
      className={`${classes} sprite--placeholder`}
      style={{ ['--ph-hue' as string]: hueFromId(assetId) }}
      role="img"
      aria-label={asset?.title ?? assetId}
      title={`Asset pendente: ${assetId}`}
    >
      <span>{assetId}</span>
    </div>
  );
}
