#!/usr/bin/env node

// Copyright 2021 Yufan You
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use strict";

let height = 16;
let width = 30;
let minecount = 120;
let grid, opened, remain;

function inGrid(x, y) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < height &&
    y >= 0 &&
    y < width
  );
}

function doAround(x, y, func) {
  for (let dx = -1; dx <= 1; ++dx) {
    for (let dy = -1; dy <= 1; ++dy) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inGrid(nx, ny)) continue;
      func(nx, ny);
    }
  }
}

function initGrid(seed) {
  grid = Array.from(Array(height), () => Array(width));
  opened = Array.from(Array(height), () => Array(width).fill(-1));
  remain = height * width - minecount;

  // rand function
  function mulberry32(a) {
    return function() {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rd = mulberry32(seed);

  // set mines
  const isMine = Array(height * width).fill(false);
  for (let i = 0; i < minecount; ++i) isMine[i] = true;
  for (let i = 1; i < isMine.length; ++i) {
    let p = Math.floor(rd() * (i + 1));
    const tmp = isMine[p];
    isMine[p] = isMine[i];
    isMine[i] = tmp;
  }
  for (let x = 0; x < height; ++x) {
    for (let y = 0; y < width; ++y) {
      grid[x][y] = isMine[x * width + y] ? 9 : 0;
    }
  }

  // calculate numbers
  for (let x = 0; x < height; ++x) {
    for (let y = 0; y < width; ++y) {
      if (grid[x][y] === 9) continue;
      doAround(x, y, (nx, ny) => {
        if (grid[nx][ny] === 9) {
          ++grid[x][y];
        }
      });
    }
  }
}

function open(x, y, round) {
  if (opened[x][y] !== -1) return;
  opened[x][y] = round;
  if (grid[x][y] !== 9) --remain;
  if (grid[x][y] === 0) doAround(x, y, (nx, ny) => open(nx, ny, round));
}

function judge(input) {
  const log = input.log;
  const output = {};

  // init
  let seed = Math.floor(Math.random() * 4294967296);
  const initdata = input.initdata;

  if (typeof initdata === 'object') {
    if (Number.isSafeInteger(initdata.seed)) seed = Math.abs(initdata.seed);
    if (Number.isSafeInteger(initdata.height) && initdata.height >= 2 && initdata.height <= 30) height = initdata.height;
    if (Number.isSafeInteger(initdata.width) && initdata.width >= 2 && initdata.width <= 50) width = initdata.width;
    minecount = Math.ceil(height * width / 4);
    if (Number.isSafeInteger(initdata.minecount) && initdata.minecount >= 1 && initdata.minecount < height * width && initdata.minecount <= 999) minecount = initdata.minecount;
  }

  if (log.length === 0) output.initdata = { seed, height, width, minecount };
  initGrid(seed);

  // restore state
  const invalid = [false, false];
  const boom = [0, 0];
  const response = {};
  for (let i = 1; i < log.length; i += 2) {
    for (let p = 0; p <= 1; ++p) {
      if (log[i][p].verdict !== "OK") {
        invalid[p] = true;
        continue;
      }
      response[p] = log[i][p].response;
      const row = response[p].row;
      const col = response[p].col;
      if (!inGrid(row, col) || (opened[row][col] !== -1 && opened[row][col] < i)) invalid[p] = true;
      else {
        if (grid[row][col] === 9) ++boom[p];
        open(row, col, i);
      }
    }
  }

  // generate output

  const stepUsed = Math.floor(log.length / 2);
  const score = boom.map((x) => (100 - x * 100 / minecount));

  let changed = [];
  for (let x = 0; x < height; ++x) {
    for (let y = 0; y < width; ++y) {
      if (log.length > 0 && opened[x][y] === log.length - 1) {
        changed.push({
          row: x,
          col: y,
          val: grid[x][y],
        });
      }
    }
  }

  output.display = { boom, stepUsed, response, status: changed };

  if (invalid[0] || invalid[1]) {
    output.command = "finish";
    let msg = " invalid";
    if (invalid[0] && invalid[1]) msg = "Both player" + msg;
    else if (invalid[0]) msg = "Player 1" + msg;
    else msg = "Player 2" + msg;
    output.display.msg = msg;
    output.content = {
      0: invalid[0] ? -1 : score[0],
      1: invalid[1] ? -1 : score[1],
    }
  } else if (remain === 0) {
    output.command = "finish";
    output.display.msg = score[0] === score[1] ? "??????" : `?????? ${(score[1] > score[0]) + 1} ??????`;
    output.content = {
      0: score[0],
      1: score[1],
    }
  } else {
    output.command = "request";
    if (changed.length === 0) changed = null;
    const request = {
      height,
      width,
      minecount,
      changed,
    }
    output.content = {
      0: request,
      1: request,
    }
  }

  return output;
}

process.stdin.resume();
process.stdin.setEncoding("utf8");

let fullInput = "";
process.stdin.on("data", (chunk) => {
  fullInput += chunk;
});

process.stdin.on("end", () => {
  const output = judge(JSON.parse(fullInput));
  console.log(JSON.stringify(output));
});
