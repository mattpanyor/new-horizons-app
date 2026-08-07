---
name: planet-texture-prompt
description: Write an image-generation prompt for a planet surface texture used by PlanetBackground, and check the returned image before it goes in
---

# Planet Texture Prompts

Produces one square image per world, saved to `public/planets/<preset-key>.jpg`
and sampled by the shader as the planet's surface. The user generates it (Gemini
Pro, or any image model); this skill writes the prompt and vets the result.

Ask what the world is, then write the prompt. Do not generate the image unless
asked — the user usually has a better model than the tools here.

## The two rules the shader imposes

Both are non-negotiable and both are invisible until the image is in place.

**1. A flat map, not a picture of a planet.** The shader does all the lighting:
sun direction, terminator, wrapped diffuse falloff, atmospheric rim, cloud and
storm shadows. Lighting baked into the image means lighting it twice —
highlights land in the wrong places and the terminator crosses a painted shadow.
Nothing downstream can fix it.

Say "flat colour map, not a lit render", "even shadowless illumination", and
"filling the entire frame edge to edge, like a satellite map with no horizon and
no sky". Mountains are the hard case: models reflexively light a range from one
side. Add "ridges read as lighter and darker rock, not as lit faces".

**2. No landmarks.** The texture is tiled stochastically — randomly-offset cells,
each wrapping a whole copy of the image. Anything recognisable recurs ten to
thirty times across the planet. Generic terrain is fine (rock is rock, nobody
counts dunes); a distinctive city, a great canyon or a striking crater becomes
twenty identical ones.

Anything **rare** or **moving** belongs in the shader, not the image:

| Feature | Why not painted |
|---|---|
| Storms, clouds | Must drift independently of the ground |
| Lightning | Motion |
| Craters | Rarity is a number; a tiled crater is not rare |

Tiling seams are *not* a concern — a heal pass makes the image tileable at load.
Don't ask for "seamless"; models are unreliable at it and it isn't needed.

## Prompt shape

Five paragraphs, in this order. It survives contact with most models.

1. **Framing** — flat top-down surface, fills the frame, no horizon or sky.
2. **Materials** — the substance of the world. Be specific about *how many*
   distinct materials and what separates them. This paragraph does the most work.
3. **Palette** — named colours, plus explicit exclusions ("no green, no blue").
4. **Detail** — "extremely fine detail at every scale at once", naming the large,
   medium and hairline structures. Then **uneven density**: "some regions crowded,
   others calm and open". Uniform busyness is what makes a surface read as
   wallpaper.
5. **Lighting** — flat, even, shadowless, a colour map not a render.

**State feature size as a fraction of the frame.** Image models default to a
comfortable composition of a handful of large forms, and asking for "fine
detail" does not move them, because they think the large forms *are* the detail.
Say "no single feature wider than a fortieth of the frame, and no one shape
dominating". Measured, a good map's features run 2–4% of frame width; a failed
one ran 8% and read as four enormous ribbons.

Do not try to fix coarse features by tiling the texture more often. It shrinks
them, but it multiplies how often those same few shapes come round — trading a
scale problem for a repetition problem, which is worse.

**Ask for districts.** Six or seven clearly different regions within the one
image, meeting at irregular boundaries, each named: one dense with filigree, one
of roiling storm cells, one nearly black and quiet, one shattered into angular
fractures, and so on.

This matters because of how the texture is sampled. Stochastic tiling shows a
different window of the image in every cell, so a uniform image makes every cell
look alike and the planet reads as wallpaper however fine the detail is. With
distinct districts, different cells land on different ones and the sphere gets
real regional variety out of a single map. It is the closest thing to a sense of
place a tiled texture can give, and it costs nothing but asking.

Then a negative list: sun, shadows, highlights, vignette, sphere, globe, planet
from space, curved horizon, atmosphere, stars, borders, text, watermark — plus
whatever this world must not contain.

**Attach a reference image** when one exists. Palette and character carry far
better from a picture than from adjectives.

## Settings

- 1:1 square, 4K from the generator
- Delivered as JPEG, quality ~80

## Checking the result

Do these before installing it. Two are measurable — measure rather than squint.

1. **Lit or flat?** Compare mean brightness of the left and right halves, then
   top and bottom. Under ~4% of range (10/255) is albedo variation; a bigger step
   is a lit render, and it must be regenerated.
2. **Symmetry.** Compare the image against its own mirror. A well-formed terrain
   scores roughly 3× the difference of a symmetric layout. Bilateral symmetry
   reads as artificial immediately.
3. **Detail at 100%.** Zoom in. If it goes smooth and painterly it will look soft
   on screen — the planet draws about 1100px across.
4. **Uneven density.** Some calm areas. Uniform detail everywhere is wallpaper.
5. **No border or vignette.** A dark edge becomes a repeating line once tiled.

There's no PIL or ImageMagick here. `sips` resizes and converts; a small pure-
Python PNG decoder (zlib + unfilter) is enough for quadrant means and mirror
differences on a downscaled copy.

## Self-luminous worlds

If the world glows rather than being lit — plasma, lava, a nebula surface — say
so explicitly and repeatedly: "every bright area is bright because the material
itself is emitting", and exclude terminator, day/night and shading in the
negative list. Insist the darks go genuinely black; grey darks kill the glow,
since the contrast between a near-white core and a black vein beside it is what
sells it.

The prompt alone is not enough. The shader multiplies the surface by the diffuse
term, so however luminous the art is, the terminator still crosses it and the
night side still goes dark — it will read as a lit rock. Such a world needs the
preset's `emissive` and `emissiveThreshold` set, which add the bright saturated
parts of the map *after* lighting instead of before. Set them once the art
exists: the right threshold depends on the image's actual histogram.

## Installing

```bash
sips -Z 1024 -s format jpeg -s formatOptions 80 "<source>" \
  --out public/planets/<preset-key>.jpg
```

- **1024, and power-of-two.** Mipmaps with `REPEAT` wrap require POT in WebGL1.
  2048 is sharper but ~1.1MB against ~500KB, on the page every user opens.
- Filename must match the preset key exactly — the loader builds the path from it.
- A preset with no file falls back to the procedural surface, so a missing or
  misnamed image degrades quietly rather than breaking.

Then set `texScale` on the preset: cells of the image per sphere radius. Higher
packs more texels behind each screen pixel; lower means fewer cell joins, where
contrast softens slightly. Around 1.6 is a reasonable start.
