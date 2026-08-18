import React from 'react';
import { Composition } from 'remotion';
import { Tutorial, totalFrames } from './Tutorial';
import { ProductFilm, filmFrames } from './Film';
import data from './data.json';

/**
 * Zwei Fassungen aus demselben Material:
 *  - `Tutorial`   führt vertont durch alle Funktionen,
 *  - `ProductFilm` zeigt in gut anderthalb Minuten, was das Produkt ausmacht.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Tutorial"
      component={Tutorial}
      durationInFrames={totalFrames}
      fps={data.fps}
      width={data.width}
      height={data.height}
    />
    <Composition
      id="ProductFilm"
      component={ProductFilm}
      durationInFrames={filmFrames}
      fps={data.fps}
      width={data.width}
      height={data.height}
    />
  </>
);
