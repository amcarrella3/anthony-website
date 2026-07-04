// renderers.js — the format registry.
// Maps a slot's feed.type to the organ that renders it. Add a format = add a
// module + one line. `color` has no organ: it's a pure fill (slot background +
// shape), handled at the slot level.

import { createEpigram } from './organs/epigram.js';
import { createThymerViewport } from './organs/thymer-viewport.js';
import { createImage } from './organs/image.js';
import { createVideo } from './organs/video.js';
import { createDrawing } from './organs/drawing.js';
import { createShape } from './organs/shape.js';
import { createText } from './organs/text.js';
import { createAudio } from './organs/audio.js';

export const renderers = {
  'epigram':         createEpigram,
  'thymer-viewport': createThymerViewport,
  'image':           createImage,
  'video':           createVideo,
  'drawing':         createDrawing,  // his brush strokes
  'shape':           createShape,    // his rect / ellipse / freeform shapes
  'text':            createText,     // rich-text he types
  'audio':           createAudio,    // uploaded sound, loops + layers
  'color':           null,          // pure fill — no organ
  // 'rss': createFeed,             // next — live external feed
};
