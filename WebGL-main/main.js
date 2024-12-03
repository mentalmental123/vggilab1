"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.

function deg2rad(angle) {
  return (angle * Math.PI) / 180;
}

// Constructor for Model
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iUIndexBuffer = gl.createBuffer();
  this.iVIndexBuffer = gl.createBuffer();
  this.uCount = 0;
  this.vCount = 0;

  this.BufferData = function (data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(data.vertices),
      gl.STREAM_DRAW
    );

    // Buffer for U-line indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iUIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(data.uIndices),
      gl.STREAM_DRAW
    );
    this.uCount = data.uIndices.length;

    // Buffer for V-line indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iVIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(data.vIndices),
      gl.STREAM_DRAW
    );
    this.vCount = data.vIndices.length;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    // Draw U-lines
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iUIndexBuffer);
    gl.drawElements(gl.LINES, this.uCount, gl.UNSIGNED_SHORT, 0);

    // Draw V-lines
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iVIndexBuffer);
    gl.drawElements(gl.LINES, this.vCount, gl.UNSIGNED_SHORT, 0);
  };
}

// Constructor for ShaderProgram
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  // Location of the attribute variable in the shader program.
  this.iAttribVertex = -1;
  // Location of the uniform specifying a color for the primitive.
  this.iColor = -1;
  // Location of the uniform matrix representing the combined transformation.
  this.iModelViewProjectionMatrix = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored surface as wireframe, along with a set of coordinate axes. */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Set the values of the projection transformation
  let projection = m4.perspective(Math.PI / 8, 1, 12, 40);

  // Get the view matrix from the SimpleRotator object.
  let modelView = spaceball.getViewMatrix();

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
  let translateToPointZero = m4.translation(0, 0, -30);

  let matAccum0 = m4.multiply(rotateToPointZero, modelView);
  let matAccum1 = m4.multiply(translateToPointZero, matAccum0);

  // Multiply the projection matrix times the modelview matrix to give the combined transformation matrix, and send that to the shader program.
  let modelViewProjection = m4.multiply(projection, matAccum1);

  gl.uniformMatrix4fv(
    shProgram.iModelViewProjectionMatrix,
    false,
    modelViewProjection
  );

  gl.uniform4fv(shProgram.iColor, [0, 1, 0, 1]); // Green color

  surface.Draw();
}

// Generate surface data with U and V polylines
function CreateSurfaceData() {
  let vertexList = [];
  let uLineIndices = [];
  let vLineIndices = [];
  let a = 1; // Constant a
  let b = 2; // Constant b
  let n = 2; // Constant n
  let stepU = 0.12; // Step for u parameter
  let stepV = 0.12; // Step for v parameter

  let uSteps = Math.round((2 * Math.PI) / stepU);
  let vSteps = Math.round((2 * Math.PI) / stepV);

  // Generate vertices
  for (let i = 0; i <= uSteps; i++) {
    let u = i * stepU;
    for (let j = 0; j <= vSteps; j++) {
      let v = j * stepV;
      let x = (a + b * Math.sin(n * u)) * Math.cos(u) - Math.sin(u) * v;
      let y = (a + b * Math.sin(n * u)) * Math.sin(u) + Math.cos(u) * v;
      let z = b * Math.cos(n * u);

      vertexList.push(x, y, z);

      // U-line indices
      if (j > 0) {
        let currIndex = i * (vSteps + 1) + j;
        uLineIndices.push(currIndex - 1, currIndex);
      }

      // V-line indices
      if (i > 0) {
        let currIndex = i * (vSteps + 1) + j;
        vLineIndices.push(currIndex - (vSteps + 1), currIndex);
      }
    }
  }

  return {
    vertices: vertexList,
    uIndices: uLineIndices,
    vIndices: vLineIndices,
  };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Basic", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(
    prog,
    "ModelViewProjectionMatrix"
  );
  shProgram.iColor = gl.getUniformLocation(prog, "color");

  surface = new Model("Surface");
  surface.BufferData(CreateSurfaceData());

  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

/**
 * Initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL(); // Initialize the WebGL graphics context
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  draw();
}
