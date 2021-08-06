// Copyright 2021 Yufan You
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

"use strict";

const HEIGHT = 16;
const WIDTH = 30;
const MINE = 99;

const grid = Array.from(Array(HEIGHT), () => Array(WIDTH));
const opened = Array.from(Array(HEIGHT), () => Array(WIDTH).fill(-1));
let remain = HEIGHT * WIDTH - MINE;

function inGrid(x, y) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < HEIGHT &&
    y >= 0 &&
    y < WIDTH
  );
}

function doAround(x, y, func) {
  for (let dx = -1; dx <= 1; ++dx) {
    for (let dy = -1; dy <= 1; ++dy) {
      if (dx === 0 && dy === 0) continue;
      const [nx, ny] = [x + dx, y + dy];
      if (!inGrid(nx, ny)) continue;
      func(x, y, nx, ny);
    }
  }
}

function initGrid(seed) {
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
  const isMine = Array(HEIGHT * WIDTH).fill(false);
  for (let i = 0; i < MINE; ++i) isMine[i] = true;
  for (let i = 1; i < isMine.length; ++i) {
    let p = Math.floor(rd() * (i + 1));
    [isMine[i], isMine[p]] = [isMine[p], isMine[i]];
  }
  for (let x = 0; x < HEIGHT; ++x) {
    for (let y = 0; y < WIDTH; ++y) {
      grid[x][y] = isMine[x * WIDTH + y] ? 9 : 0;
    }
  }

  // calculate numbers
  for (let x = 0; x < HEIGHT; ++x) {
    for (let y = 0; y < WIDTH; ++y) {
      if (grid[x][y] == 9) continue;
      doAround((x, y, nx, ny) => {
        if (grid[nx][ny] == 9) {
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
  if (grid[x][y] === 0) doAround((...[, , nx, ny]) => open(nx, ny, round));
}

function judge(input) {
  const log = input.log;
  const output = {};

  // init
  let seed = new Date().getTime();
  if (Number.isInteger(input.initdata)) seed = input.initdata;
  if (log.length === 0) output.initdata = seed;
  initGrid(seed);

  // restore state
  const invalid = [false, false];
  const score = [0, 0];
  for (let i = 1; i < log.length; i += 2) {
    for (let p = 0; p <= 1; ++p) {
      const { row, col } = log[i][p].response;
      if (!inGrid(row, col) || opened[row][col] < i) invalid[p] = true;
      else {
        if (grid[row][col] !== 9) ++score[p];
        open(row, col);
      }
    }
  }

  // generate output
  if (invalid[0] || invalid[1]) {
    output.command = "finish";
    let msg = "INVALID MOVE: ";
    if (invalid[0] && invalid[1]) msg += "both player";
    else if (invalid[0]) msg += "player 1";
    else msg += "player 2";
    output.display = { msg };
    output.content = {
      0: 1 + invalid[1] - invalid[0],
      1: 1 + invalid[0] - invalid[1],
    }
  } else if (remain === 0) {
    output.command = "finish";
    output.display = { msg: "FINISHED" };
    let win;
    if (score[0] === score[1]) win = 0;
    else if (score[0] > score[1]) win = 1;
    else win = -1;
    output.content = {
      0: 1 + win,
      1: 1 - win,
    }
  } else {
    output.command = "request";
    let changed = [];
    for (let x = 0; x < HEIGHT; ++x) {
      for (let y = 0; y < WIDTH; ++y) {
        if (log.length > 0 && opened[x][y] === log.length - 1) {
          changed.push({
            row: x,
            col: y,
            val: grid[x][y],
          });
        }
      }
    }
    if (changed.length === 0) changed = null;
    output.display = { status: changed };
    const request = {
      height: HEIGHT,
      width: WIDTH,
      minecount: MINE,
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
