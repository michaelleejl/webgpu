const rand = (min, max) => {
    if (min === undefined) {
        min = 0;
        max = 1;
    }
    else if (max === undefined) {
        max = min;
        min = 0;
    }
    return min + Math.random() * (max - min);
};
function createCircleVertices() {
    const radius = 0.5;
    const numSubdivisions = 24;
    const innerRadius = 0.25;
    const startAngle = 0;
    const endAngle = Math.PI * 2;
    // 2 triangles per subdivision, 3 verts per tri, 2 values (xy) each.
    const numVertices = numSubdivisions * 3 * 2;
    const vertexData = new Array(numVertices * 5);
    let offset = 0;
    const addVertex = (x, y, r, g, b) => {
        vertexData[offset++] = x;
        vertexData[offset++] = y;
        vertexData[offset++] = r;
        vertexData[offset++] = g;
        vertexData[offset++] = b;
    };
    // 2 triangles per subdivision
    //
    // 0--1 4
    // | / /|
    // |/ / |
    // 2 3--5
    const outerColor = [0.1, 0.1, 0.1];
    const innerColor = [1, 1, 1];
    for (let i = 0; i < numSubdivisions; ++i) {
        const angle1 = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
        const angle2 = startAngle + (i + 1) * (endAngle - startAngle) / numSubdivisions;
        const c1 = Math.cos(angle1);
        const s1 = Math.sin(angle1);
        const c2 = Math.cos(angle2);
        const s2 = Math.sin(angle2);
        // first triangle
        addVertex(c1 * radius, s1 * radius, ...outerColor);
        addVertex(c2 * radius, s2 * radius, ...outerColor);
        addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
        // second triangle
        addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
        addVertex(c2 * radius, s2 * radius, ...outerColor);
        addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor);
    }
    return vertexData;
}
async function vertexBuffer() {
    let adapter = await navigator.gpu?.requestAdapter();
    let device = await adapter.requestDevice();
    if (!device) {
        console.log("No GPU");
        return;
    }
    let format = navigator.gpu.getPreferredCanvasFormat();
    let canvas = document.querySelector('canvas');
    let context = canvas.getContext('webgpu');
    context.configure({ device, format });
    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct InterStage {
                @builtin(position) positionData: vec4f,
                @location(0)       colorData   : vec4f,
            }

            @vertex fn vs(
                @location(0) position: vec2f,
                @location(1) color: vec4f,
                @location(2) offset: vec2f,
                @location(3) scale: vec2f,
                @location(4) perVertColor: vec3f,
                @builtin(instance_index) idx: u32
            ) -> InterStage {
                var is: InterStage;
                let s = scale;
                let o = offset;
                let c = color;
                let xy = (position + o) * s;
                is.positionData = vec4f(xy, 0, 1);
                is.colorData    = c * vec4f(perVertColor, 1);
                return is;
            }

            @fragment fn fs(is: InterStage) -> @location(0) vec4f {
                return is.colorData;
            }
        `
    });
    let pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: [
                {
                    arrayStride: 5 * 4,
                    attributes: [
                        { shaderLocation: 0, format: 'float32x2', offset: 0 },
                        { shaderLocation: 4, format: 'float32x3', offset: 8 }
                    ]
                },
                {
                    arrayStride: 6 * 4,
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 1, format: 'float32x4', offset: 0 },
                        { shaderLocation: 2, format: 'float32x2', offset: 16 },
                    ]
                },
                {
                    arrayStride: 2 * 4,
                    stepMode: 'instance',
                    attributes: [{ shaderLocation: 3, format: 'float32x2', offset: 0 }]
                }
            ]
        },
        layout: "auto",
        fragment: { module, targets: [{ format }] }
    });
    let n = 100;
    let positionVertexBuffer = device.createBuffer({
        size: 4 * 144 * 5,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
    let colorsOffsetsVertexBuffer = device.createBuffer({
        size: n * 4 * 6,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
    let scalesVertexBuffer = device.createBuffer({
        size: n * 4 * 2,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
    });
    let colorsOffsetsValues = new Float32Array(n * 6);
    let scalesValues = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
        let s = rand(0.2, 0.5);
        scalesValues.set([s, s], 2 * i);
        colorsOffsetsValues.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], 6 * i);
        colorsOffsetsValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], 4 + 6 * i);
    }
    const vertices = createCircleVertices();
    const vertexData = new Float32Array(vertices);
    let encoder = device.createCommandEncoder();
    let pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 1, g: 1, b: 1, a: 1 }
            }]
    });
    pass.setPipeline(pipeline);
    device.queue.writeBuffer(positionVertexBuffer, 0, vertexData);
    device.queue.writeBuffer(colorsOffsetsVertexBuffer, 0, colorsOffsetsValues);
    device.queue.writeBuffer(scalesVertexBuffer, 0, scalesValues);
    pass.setVertexBuffer(0, positionVertexBuffer);
    pass.setVertexBuffer(1, colorsOffsetsVertexBuffer);
    pass.setVertexBuffer(2, scalesVertexBuffer);
    pass.draw(144, n);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
vertexBuffer();
