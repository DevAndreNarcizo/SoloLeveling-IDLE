# Prompts de geração de assets — Caçador de Fendas

> Arquivo GERADO a partir de `src/assets/manifest.ts`. Não edite manualmente:
> altere o manifesto e rode `npm run assets:prompts`.

Total de assets: **44**. O jogo funciona sem nenhum deles (usa placeholders) e passa a exibir cada arquivo automaticamente assim que ele é colocado no caminho indicado.

## 1. Regras globais (valem para todos os prompts)

| Regra | Valor |
| --- | --- |
| Formato final | PNG (sRGB, 8 bits por canal) |
| Nome do arquivo | exatamente o `id` do asset + `.png`, em minúsculas |
| Pasta de destino | `src/assets/sprites/<pasta da categoria>/` |
| Orientação | caçadores olham para a **direita**; monstros e guardiões para a **esquerda** |
| Texto na imagem | proibido em qualquer asset |
| Animação | não gerar spritesheets: 1 frame estático por asset (o movimento é feito por CSS) |

Dimensões por categoria:

| Categoria | Pasta | Geração recomendada | Tamanho final | Fundo |
| --- | --- | --- | --- | --- |
| Caçadores (classes jogáveis) | `hunters/` | 1024x1024 (1:1) | 256x256 | transparente |
| Monstros | `monsters/` | 1024x1024 (1:1) | 256x256 | transparente |
| Guardiões (chefes) | `monsters/` | 1024x1024 (1:1) | 384x384 | transparente |
| Cenários | `backgrounds/` | 1920x1080 ou a proporção 16:9 mais próxima disponível | 1280x720 | opaco |
| Itens (ícones de inventário) | `items/` | 1024x1024 (1:1) | 128x128 | transparente |
| Ícones de interface | `icons/` | 1024x1024 (1:1) | 128x128 | transparente |
| Identidade | `ui/` | 1024x1024 (1:1) | 512x512 | transparente |

### Direção de arte (já embutida em cada prompt)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.
```

### Restrições (já embutidas em cada prompt)

Se a ferramenta tiver campo separado de *negative prompt*, mova esta linha para lá (sem o prefixo "Avoid:").

```text
Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

## 2. Fluxo de trabalho para não errar

1. **Âncora de estilo:** gere `hunter_guardian` até ficar satisfeito. Ele define traço, paleta e proporção.
2. **Referência em todos os demais:** anexe a âncora como imagem de referência de estilo em cada geração seguinte (ex.: "use the attached image only as art style reference"). É o que mais reduz inconsistência entre assets.
3. **Um asset por geração.** Copie o bloco de prompt inteiro, sem editar; cada bloco é autossuficiente.
4. **Confira antes de aceitar** (checklist da seção 3). Se falhar em qualquer item, gere novamente em vez de corrigir à mão.
5. **Pós-processamento:**
   - se o fundo veio em cor sólida (chroma), remova-o; a cor de chroma indicada em cada asset foi escolhida para não colidir com as cores do próprio desenho;
   - recorte as sobras e centralize o desenho mantendo uma margem de ~5%; personagens e monstros devem encostar os pés próximo à borda inferior;
   - redimensione para o **tamanho final exato** da tabela (interpolação bicúbica/Lanczos) — não distorça: preencha com transparência se a proporção diferir;
   - exporte como PNG com o nome e a pasta indicados.
6. **Valide:** rode `npm run assets:check`. O script acusa arquivo ausente, dimensão errada, falta de canal alfa e arquivos fora do manifesto.

## 3. Checklist de aceite por imagem

- [ ] Um único sujeito, inteiro, sem partes cortadas.
- [ ] Orientação correta (caçador → direita, monstro/guardião → esquerda).
- [ ] Sem texto, marca d'água, moldura ou elementos de UI.
- [ ] Sem sombra projetada no chão (sprites) e sem personagens (cenários).
- [ ] Contorno escuro e paleta coerentes com a âncora de estilo.
- [ ] Legível quando reduzido ao tamanho final.
- [ ] Design original: nada que reproduza personagens, logotipos ou obras existentes.

## 4. Índice

| # | ID | Descrição | Arquivo final | Tamanho |
| --- | --- | --- | --- | --- |
| 1 | `hunter_guardian` | Caçador — Guardião | `src/assets/sprites/hunters/hunter_guardian.png` | 256x256 |
| 2 | `hunter_blade` | Caçador — Lâmina | `src/assets/sprites/hunters/hunter_blade.png` | 256x256 |
| 3 | `hunter_arcanist` | Caçador — Arcanista | `src/assets/sprites/hunters/hunter_arcanist.png` | 256x256 |
| 4 | `hunter_marksman` | Caçador — Atirador | `src/assets/sprites/hunters/hunter_marksman.png` | 256x256 |
| 5 | `hunter_cleric` | Caçador — Clérigo | `src/assets/sprites/hunters/hunter_cleric.png` | 256x256 |
| 6 | `monster_rust_rat` | Rato de Ferrugem (Rank E) | `src/assets/sprites/monsters/monster_rust_rat.png` | 256x256 |
| 7 | `monster_crystal_grub` | Larva de Cristal (Rank E) | `src/assets/sprites/monsters/monster_crystal_grub.png` | 256x256 |
| 8 | `monster_lantern_toad` | Sapo-Lanterna (Rank D) | `src/assets/sprites/monsters/monster_lantern_toad.png` | 256x256 |
| 9 | `monster_mire_stalker` | Espreitador do Lodo (Rank D) | `src/assets/sprites/monsters/monster_mire_stalker.png` | 256x256 |
| 10 | `monster_stone_sentinel` | Sentinela de Pedra (Rank C) | `src/assets/sprites/monsters/monster_stone_sentinel.png` | 256x256 |
| 11 | `monster_hollow_archer` | Arqueiro Oco (Rank C) | `src/assets/sprites/monsters/monster_hollow_archer.png` | 256x256 |
| 12 | `monster_rime_wolf` | Lobo de Geada (Rank B) | `src/assets/sprites/monsters/monster_rime_wolf.png` | 256x256 |
| 13 | `monster_frost_shaman` | Xamã do Gelo (Rank B) | `src/assets/sprites/monsters/monster_frost_shaman.png` | 256x256 |
| 14 | `monster_ember_knight` | Cavaleiro de Brasa (Rank A) | `src/assets/sprites/monsters/monster_ember_knight.png` | 256x256 |
| 15 | `monster_soot_imp` | Diabrete de Fuligem (Rank A) | `src/assets/sprites/monsters/monster_soot_imp.png` | 256x256 |
| 16 | `monster_star_eater` | Devorador Estelar (Rank S) | `src/assets/sprites/monsters/monster_star_eater.png` | 256x256 |
| 17 | `monster_void_watcher` | Vigia do Vazio (Rank S) | `src/assets/sprites/monsters/monster_void_watcher.png` | 256x256 |
| 18 | `monster_plated_alpha` | Guardião — Alfa Couraçado (Rank E) | `src/assets/sprites/monsters/monster_plated_alpha.png` | 384x384 |
| 19 | `monster_bog_hydra` | Guardião — Hidra do Brejo (Rank D) | `src/assets/sprites/monsters/monster_bog_hydra.png` | 384x384 |
| 20 | `monster_runic_colossus` | Guardião — Colosso Rúnico (Rank C) | `src/assets/sprites/monsters/monster_runic_colossus.png` | 384x384 |
| 21 | `monster_glacial_wyrm` | Guardião — Wyrm Glacial (Rank B) | `src/assets/sprites/monsters/monster_glacial_wyrm.png` | 384x384 |
| 22 | `monster_pyre_tyrant` | Guardião — Tirano da Pira (Rank A) | `src/assets/sprites/monsters/monster_pyre_tyrant.png` | 384x384 |
| 23 | `monster_eclipse_herald` | Guardião — Arauto do Eclipse (Rank S) | `src/assets/sprites/monsters/monster_eclipse_herald.png` | 384x384 |
| 24 | `bg_title` | Fundo — Tela inicial | `src/assets/sprites/backgrounds/bg_title.png` | 1280x720 |
| 25 | `bg_hollow_tunnels` | Fundo — Túneis Ocos (Rank E) | `src/assets/sprites/backgrounds/bg_hollow_tunnels.png` | 1280x720 |
| 26 | `bg_ashen_marsh` | Fundo — Pântano Cinzento (Rank D) | `src/assets/sprites/backgrounds/bg_ashen_marsh.png` | 1280x720 |
| 27 | `bg_sunken_ruins` | Fundo — Ruínas Afundadas (Rank C) | `src/assets/sprites/backgrounds/bg_sunken_ruins.png` | 1280x720 |
| 28 | `bg_shattered_tundra` | Fundo — Tundra Estilhaçada (Rank B) | `src/assets/sprites/backgrounds/bg_shattered_tundra.png` | 1280x720 |
| 29 | `bg_cinder_citadel` | Fundo — Cidadela de Cinzas (Rank A) | `src/assets/sprites/backgrounds/bg_cinder_citadel.png` | 1280x720 |
| 30 | `bg_void_threshold` | Fundo — Limiar do Vazio (Rank S) | `src/assets/sprites/backgrounds/bg_void_threshold.png` | 1280x720 |
| 31 | `item_weapon_guardian` | Item — Espada Larga | `src/assets/sprites/items/item_weapon_guardian.png` | 128x128 |
| 32 | `item_weapon_blade` | Item — Adagas Gêmeas | `src/assets/sprites/items/item_weapon_blade.png` | 128x128 |
| 33 | `item_weapon_arcanist` | Item — Cajado Rúnico | `src/assets/sprites/items/item_weapon_arcanist.png` | 128x128 |
| 34 | `item_weapon_marksman` | Item — Arco Longo | `src/assets/sprites/items/item_weapon_marksman.png` | 128x128 |
| 35 | `item_weapon_cleric` | Item — Maça Consagrada | `src/assets/sprites/items/item_weapon_cleric.png` | 128x128 |
| 36 | `item_armor` | Item — Armadura | `src/assets/sprites/items/item_armor.png` | 128x128 |
| 37 | `item_accessory` | Item — Acessório | `src/assets/sprites/items/item_accessory.png` | 128x128 |
| 38 | `icon_gold` | Ícone — Ouro | `src/assets/sprites/icons/icon_gold.png` | 128x128 |
| 39 | `icon_essence` | Ícone — Essência | `src/assets/sprites/icons/icon_essence.png` | 128x128 |
| 40 | `icon_str` | Ícone — Força | `src/assets/sprites/icons/icon_str.png` | 128x128 |
| 41 | `icon_agi` | Ícone — Agilidade | `src/assets/sprites/icons/icon_agi.png` | 128x128 |
| 42 | `icon_int` | Ícone — Inteligência | `src/assets/sprites/icons/icon_int.png` | 128x128 |
| 43 | `icon_vit` | Ícone — Vitalidade | `src/assets/sprites/icons/icon_vit.png` | 128x128 |
| 44 | `ui_logo` | UI — Emblema do jogo | `src/assets/sprites/ui/ui_logo.png` | 512x512 |

## 5. Prompts

### Caçadores (classes jogáveis)

Sempre voltados para a DIREITA. Gere `hunter_guardian` primeiro e use-o como referência de estilo para todos os demais assets.

#### `hunter_guardian` — Caçador — Guardião

- **Arquivo final:** `src/assets/sprites/hunters/hunter_guardian.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.

Subject: A broad-shouldered rift hunter in heavy dark steel plate armor worn over a modern tactical bodysuit, holding a large broadsword with a faint cyan glowing edge in both hands, short hair, determined expression, navy cloth sash at the waist.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `hunter_blade` — Caçador — Lâmina

- **Arquivo final:** `src/assets/sprites/hunters/hunter_blade.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.

Subject: A lean, agile rift hunter in a fitted dark hooded jacket and light leather armor straps, holding two short curved daggers with violet glowing edges in a low reverse grip, hood down, sharp focused eyes, slightly crouched stance.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `hunter_arcanist` — Caçador — Arcanista

- **Arquivo final:** `src/assets/sprites/hunters/hunter_arcanist.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.

Subject: A rift hunter spellcaster in a long dark asymmetrical coat with glowing violet rune embroidery, holding a tall metal staff topped with a floating cyan crystal, one hand raised with small arcane sparks, calm confident expression.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `hunter_marksman` — Caçador — Atirador

- **Arquivo final:** `src/assets/sprites/hunters/hunter_marksman.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.

Subject: A rift hunter archer in a dark sleeveless tactical vest with a single shoulder guard and a quiver on the back, holding a tall recurve longbow with a cyan glowing string, arrow nocked and pointing forward-down, steady stance.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `hunter_cleric` — Caçador — Clérigo

- **Arquivo final:** `src/assets/sprites/hunters/hunter_cleric.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game character sprite, strict side view, character facing RIGHT, standing in a ready combat idle pose. The entire figure is visible from head to feet, centered horizontally, occupying about 80% of the canvas height, feet resting near the bottom edge with a small margin. Exactly one character.

Subject: A rift hunter battle cleric in a white and navy armored robe with silver trim, holding a flanged mace in one hand and a small round shield with a glowing violet sun emblem shape in the other, serene resolute expression.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Monstros

Sempre voltados para a ESQUERDA (encaram o caçador). Os ecos reutilizam estes mesmos sprites com filtro aplicado em runtime — não é necessário gerar versões "sombra".

#### `monster_rust_rat` — Rato de Ferrugem (Rank E)

- **Arquivo final:** `src/assets/sprites/monsters/monster_rust_rat.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A dog-sized mutant rat with patches of rusty metal plates fused into its fur, glowing orange eyes, bare scaly tail, bared incisors.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_crystal_grub` — Larva de Cristal (Rank E)

- **Arquivo final:** `src/assets/sprites/monsters/monster_crystal_grub.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A fat pale segmented grub the size of a barrel with jagged cyan crystals growing along its back, small mandibles, tiny stubby legs.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_lantern_toad` — Sapo-Lanterna (Rank D)

- **Arquivo final:** `src/assets/sprites/monsters/monster_lantern_toad.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#FF00FF`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A large bloated swamp toad with dull olive-grey warty skin and a glowing pale-yellow lantern lure hanging from a stalk on its forehead, wide mouth, heavy-lidded eyes.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #FF00FF background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_mire_stalker` — Espreitador do Lodo (Rank D)

- **Arquivo final:** `src/assets/sprites/monsters/monster_mire_stalker.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#FF00FF`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A thin hunched humanoid swamp creature made of dripping dark mud and tangled reeds, long clawed arms reaching the ground, two small glowing white eyes, no visible mouth.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #FF00FF background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_stone_sentinel` — Sentinela de Pedra (Rank C)

- **Arquivo final:** `src/assets/sprites/monsters/monster_stone_sentinel.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A bulky humanoid construct built from cracked grey temple stone blocks covered in barnacles, a single glowing cyan rune eye in the chest, massive fists, short legs.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_hollow_archer` — Arqueiro Oco (Rank C)

- **Arquivo final:** `src/assets/sprites/monsters/monster_hollow_archer.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: An empty suit of corroded bronze armor animated by violet mist leaking from its joints, no body inside, drawing a spectral bow, tattered cloth hanging from the helmet.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_rime_wolf` — Lobo de Geada (Rank B)

- **Arquivo final:** `src/assets/sprites/monsters/monster_rime_wolf.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A large lean wolf with white-blue fur hardened into icy spikes along the spine, frosty breath, pale glowing blue eyes, snarling low stance.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_frost_shaman` — Xamã do Gelo (Rank B)

- **Arquivo final:** `src/assets/sprites/monsters/monster_frost_shaman.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A tall gaunt blue-skinned humanoid shaman wrapped in grey furs and bone charms, wearing an antlered skull mask, holding a gnarled staff with a floating shard of ice at its tip.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_ember_knight` — Cavaleiro de Brasa (Rank A)

- **Arquivo final:** `src/assets/sprites/monsters/monster_ember_knight.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A heavily armored knight in scorched black plate armor with glowing orange cracks like cooling lava, flames flickering inside the closed visor, holding a jagged greatsword that smolders.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_soot_imp` — Diabrete de Fuligem (Rank A)

- **Arquivo final:** `src/assets/sprites/monsters/monster_soot_imp.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A small wiry imp made of black soot and smoke with glowing ember eyes and a wide jagged grin, short horns, hovering slightly with a trailing smoke tail, holding a small ball of fire.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_star_eater` — Devorador Estelar (Rank S)

- **Arquivo final:** `src/assets/sprites/monsters/monster_star_eater.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A massive eyeless beast with a body like a dark starry night sky, a huge circular maw ringed with crystalline teeth, four thick limbs, tiny points of light drifting inside its translucent skin.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_void_watcher` — Vigia do Vazio (Rank S)

- **Arquivo final:** `src/assets/sprites/monsters/monster_void_watcher.png`
- **Tamanho final:** 256x256 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game enemy sprite, strict side view, creature facing LEFT, in a menacing idle pose. The entire creature is visible, centered horizontally, occupying about 75% of the canvas, resting near the bottom edge with a small margin. Exactly one creature.

Subject: A floating slender robed figure with no face, a single large vertical violet eye where the head should be, long sleeves ending in drifting ribbons of darkness, three thin halo rings orbiting behind it.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Guardiões (chefes)

Voltados para a ESQUERDA, canvas maior (384x384) para parecerem imponentes ao lado do caçador.

#### `monster_plated_alpha` — Guardião — Alfa Couraçado (Rank E)

- **Arquivo final:** `src/assets/sprites/monsters/monster_plated_alpha.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A bear-sized alpha mutant rat completely covered in overlapping rusted iron plates like an armadillo, scarred snout, one broken tusk-like incisor, glowing red-orange eyes, thick spiked tail.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_bog_hydra` — Guardião — Hidra do Brejo (Rank D)

- **Arquivo final:** `src/assets/sprites/monsters/monster_bog_hydra.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#FF00FF`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A three-headed swamp hydra with dark olive-grey scaled necks rising from a mossy bulky body, each head with pale glowing yellow eyes and dripping jaws, hanging vines and mud on its back.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #FF00FF background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_runic_colossus` — Guardião — Colosso Rúnico (Rank C)

- **Arquivo final:** `src/assets/sprites/monsters/monster_runic_colossus.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A towering ancient stone colossus with a broad torso carved with glowing cyan runes, a crown-like ring of broken pillars on its shoulders, one arm ending in a giant stone hammer, moss and coral on its legs.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_glacial_wyrm` — Guardião — Wyrm Glacial (Rank B)

- **Arquivo final:** `src/assets/sprites/monsters/monster_glacial_wyrm.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A long wingless serpentine ice dragon coiled upright, translucent blue ice-plate scales, a crest of jagged icicle horns, cold mist pouring from its jaws, pale glowing eyes.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_pyre_tyrant` — Guardião — Tirano da Pira (Rank A)

- **Arquivo final:** `src/assets/sprites/monsters/monster_pyre_tyrant.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A huge horned warlord in molten black-and-gold armor with a mantle of living flames, a burning crown fused to its helmet, gripping a colossal flaming halberd, embers rising around it.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `monster_eclipse_herald` — Guardião — Arauto do Eclipse (Rank S)

- **Arquivo final:** `src/assets/sprites/monsters/monster_eclipse_herald.png`
- **Tamanho final:** 384x384 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Full-body game boss sprite, strict side view, creature facing LEFT, in an imposing, threatening idle pose. The entire creature is visible, centered horizontally, occupying about 90% of the canvas, resting near the bottom edge with a small margin. Exactly one creature, clearly larger and more elaborate than a regular enemy.

Subject: A majestic terrifying winged entity in ornate dark armor, its head replaced by a black eclipsed sun with a thin blazing violet corona, six tattered wings of shadow, holding a long spear of pure white light.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Cenários

Opacos, 16:9. O terço inferior precisa de um chão plano e livre: é onde os sprites são posicionados.

#### `bg_title` — Fundo — Tela inicial

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_title.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: A rain-soaked modern city rooftop at night overlooking a skyline, with a gigantic vertical glowing violet-cyan rift tearing open the sky in the distance, dramatic clouds spiraling around it.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_hollow_tunnels` — Fundo — Túneis Ocos (Rank E)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_hollow_tunnels.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: An abandoned underground subway tunnel with cracked tiled walls, rusted rails, flickering emergency lights, and small cyan crystals growing from the concrete.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_ashen_marsh` — Fundo — Pântano Cinzento (Rank D)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_ashen_marsh.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: A fog-covered grey swamp at dusk with dead twisted trees, still dark water, floating pale-yellow will-o-wisp lights, and a muddy path across the foreground.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_sunken_ruins` — Fundo — Ruínas Afundadas (Rank C)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_sunken_ruins.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: A half-flooded ancient temple hall with broken columns, shafts of teal light coming through the collapsed ceiling, faintly glowing cyan runes on the walls, wet stone floor.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_shattered_tundra` — Fundo — Tundra Estilhaçada (Rank B)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_shattered_tundra.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: A frozen plain under a dark aurora sky, the ice ground split by deep glowing blue fissures, jagged ice spires in the distance, blowing snow.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_cinder_citadel` — Fundo — Cidadela de Cinzas (Rank A)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_cinder_citadel.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: The courtyard of a burnt black stone fortress with glowing embers in the cracks of the flagstones, falling ash, distant towers lit by orange fire against a smoke-filled sky.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `bg_void_threshold` — Fundo — Limiar do Vazio (Rank S)

- **Arquivo final:** `src/assets/sprites/backgrounds/bg_void_threshold.png`
- **Tamanho final:** 1280x720 px — **Geração:** 1920x1080 ou a proporção 16:9 mais próxima disponível
- **Fundo:** opaco, ocupa todo o quadro

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Wide 2D side-view game battle background, 16:9, eye-level camera. A clear, mostly flat ground strip runs across the lower third of the image where characters will stand. Two or three depth layers fading into atmospheric haze. Slightly darker and less saturated than foreground sprites so characters stand out. Absolutely no characters, no creatures, no people.

Subject: A platform of floating shattered obsidian slabs suspended in a starless void, a huge black eclipsed sun with a violet corona on the horizon, drifting fragments and thin streams of light.

Background: this image IS the background; fill the entire 16:9 canvas edge to edge with no borders or vignette frame.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Itens (ícones de inventário)

A raridade e o aprimoramento são indicados pela moldura/etiqueta da UI; o ícone em si é único por tipo.

#### `item_weapon_guardian` — Item — Espada Larga

- **Arquivo final:** `src/assets/sprites/items/item_weapon_guardian.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A heavy steel broadsword with a wide blade, dark leather-wrapped grip and a faint cyan glow along the edge.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_weapon_blade` — Item — Adagas Gêmeas

- **Arquivo final:** `src/assets/sprites/items/item_weapon_blade.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A pair of short curved daggers crossed over each other, dark metal blades with violet glowing edges.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_weapon_arcanist` — Item — Cajado Rúnico

- **Arquivo final:** `src/assets/sprites/items/item_weapon_arcanist.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A tall dark metal staff engraved with runes, topped with a floating cyan crystal held by three prongs.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_weapon_marksman` — Item — Arco Longo

- **Arquivo final:** `src/assets/sprites/items/item_weapon_marksman.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A tall dark recurve longbow with metal reinforcements and a glowing cyan bowstring.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_weapon_cleric` — Item — Maça Consagrada

- **Arquivo final:** `src/assets/sprites/items/item_weapon_cleric.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A silver flanged mace with a navy leather grip and a small violet gem set in the head.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_armor` — Item — Armadura

- **Arquivo final:** `src/assets/sprites/items/item_armor.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A dark steel chest plate armor piece with layered shoulder guards and thin cyan glowing seams, shown empty with no body.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `item_accessory` — Item — Acessório

- **Arquivo final:** `src/assets/sprites/items/item_accessory.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game inventory icon of one object, centered, shown at a slight three-quarter angle, occupying about 75% of the canvas. No frame, no border, no slot background, no hands holding it.

Subject: A silver ring set with a faceted glowing violet gemstone, small engraved runes around the band.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Ícones de interface

Precisam permanecer legíveis a 24px.

#### `icon_gold` — Ícone — Ouro

- **Arquivo final:** `src/assets/sprites/icons/icon_gold.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: A small stack of three shiny gold coins with a simple rift-shaped notch engraved on the top coin.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `icon_essence` — Ícone — Essência

- **Arquivo final:** `src/assets/sprites/icons/icon_essence.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: A teardrop-shaped crystal vial filled with swirling glowing violet smoke, sealed with a dark metal cap.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `icon_str` — Ícone — Força

- **Arquivo final:** `src/assets/sprites/icons/icon_str.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: A clenched armored gauntlet fist, red-orange accent glow.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `icon_agi` — Ícone — Agilidade

- **Arquivo final:** `src/assets/sprites/icons/icon_agi.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#FF00FF`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: A winged boot in motion, chartreuse-yellow accent glow.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #FF00FF background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `icon_int` — Ícone — Inteligência

- **Arquivo final:** `src/assets/sprites/icons/icon_int.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: An open spellbook with a small star-shaped spark rising from its pages, cyan accent glow.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

#### `icon_vit` — Ícone — Vitalidade

- **Arquivo final:** `src/assets/sprites/icons/icon_vit.png`
- **Tamanho final:** 128x128 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game UI icon of one simple symbol, centered, front view, occupying about 70% of the canvas, bold and readable silhouette that stays clear at 24 pixels. No frame, no border, no badge background.

Subject: A faceted heart-shaped crystal, crimson accent glow.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```

### Identidade

Sem qualquer texto: o nome do jogo é renderizado pela UI.

#### `ui_logo` — UI — Emblema do jogo

- **Arquivo final:** `src/assets/sprites/ui/ui_logo.png`
- **Tamanho final:** 512x512 px — **Geração:** 1024x1024 (1:1)
- **Fundo:** transparente (chroma de contingência: `#00FF00`)

```text
Stylized 2D game art, cel-shaded illustration with bold clean dark outlines, flat colors with two-tone shadows and a soft rim light. Dark fantasy world of modern-day rift hunters. Cohesive limited palette: deep navy and charcoal base tones, electric violet and cyan glow accents. Crisp edges, strong readable silhouette at small sizes. Original design.

Single game emblem, centered, front view, symmetrical, occupying about 80% of the canvas. No lettering of any kind.

Subject: A heraldic emblem of a vertical jagged glowing violet-cyan rift splitting a dark shield, with two crossed blades behind the shield and small shards floating around the rift.

Background: fully transparent (PNG with alpha channel). If transparency is not supported, use a perfectly flat solid #00FF00 background with no gradient, no texture, no floor and no shadow.

Avoid: text, letters, numbers, watermark, signature, logo, UI elements, frame, border, multiple subjects, cropped body parts, extra limbs, photorealism, 3D render, blur, noise, ground shadow, cast shadow, existing or copyrighted characters.
```
