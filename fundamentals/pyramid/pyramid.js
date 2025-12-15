async function pyramid() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter.requestDevice();
    if (!device) {
        console.log("No suitable GPU found");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('webgpu');
    context.configure({
        device, format
    });
    const module = device.createShaderModule({
        code: /*wgsl*/ `
        struct VertexInput {
            @location(0) position: vec3f,
            @location(1) color: vec4f
        }

        struct VertexOutput{
            @builtin(position) position: vec4f,
            @location(0)       color: vec4f
        }

        @group(0) @binding(0) var<uniform> time: f32;

        @vertex fn vs_main(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            let alpha = cos(time);
            let beta = sin(time);
            var position = vec3f(
                input.position.x,
                alpha * input.position.y + beta * input.position.z,
                alpha * input.position.z - beta * input.position.y,
            );
            output.position = vec4f(position.x, position.y * 2.0, input.position.y, 1.0);
            output.color    = input.color;
            return output;
        }

        @fragment fn fs_main(input: VertexOutput) -> @location(0) vec4f {
            return input.color;
        }
        `
    });
    const vertexPositions = [
        [-0.5, -0.5, -0.3],
        [0.5, -0.5, -0.3],
        [0.5, 0.5, -0.3],
        [-0.5, 0.5, -0.3],
        [0.0, 0.0, 0.5]
    ];
    const vertexColors = [
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [0, 255, 0, 255],
        [0, 80, 0, 255],
    ];
    const vertices = new Float32Array(5 * 4);
    const colors = new Uint8Array(vertices.buffer);
    for (let i = 0; i < vertexPositions.length; i++) {
        let vertexPosition = vertexPositions[i];
        let color = vertexColors[i];
        vertices.set(vertexPosition, i * (3 + 1));
        colors.set(color, 4 * (3 + (4 * i)));
    }
    const vertexAndColorBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 3, 4, 0, 0, 4, 1, 1, 4, 2, 2, 4, 3]);
    const indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    const timeBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: [
                {
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                        { shaderLocation: 1, offset: 12, format: "unorm8x4" }
                    ],
                    arrayStride: 16,
                }
            ]
        },
        fragment: {
            module,
            targets: [{ format }]
        },
        layout: "auto",
    });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: timeBuffer }]
    });
    let angle = 0.0;
    device.queue.writeBuffer(vertexAndColorBuffer, 0, vertices, 0);
    device.queue.writeBuffer(indexBuffer, 0, indices, 0);
    function frame() {
        angle += 0.01;
        const encoder = device.createCommandEncoder();
        let pass = encoder.beginRenderPass({
            colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: [1.0, 1.0, 1.0, 1.0]
                }]
        });
        let timeData = new Float32Array(1);
        timeData.set([angle % 360], 0);
        pass.setBindGroup(0, bindGroup);
        device.queue.writeBuffer(timeBuffer, 0, timeData, 0);
        pass.setVertexBuffer(0, vertexAndColorBuffer);
        pass.setIndexBuffer(indexBuffer, "uint32");
        pass.setPipeline(pipeline);
        pass.drawIndexed(indices.length);
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
pyramid();
