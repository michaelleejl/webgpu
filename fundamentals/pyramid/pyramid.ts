async function pyramid() {
    const adapter = await navigator.gpu?.requestAdapter()
    const device = await adapter.requestDevice()

    if (!device) {
        console.log("No suitable GPU found")
    }

    const format = navigator.gpu.getPreferredCanvasFormat()

    const canvas = document.querySelector('canvas')
    const context = canvas.getContext('webgpu')

    context.configure({
        device, format
    })

    const module = device.createShaderModule({
        code: /*wgsl*/`
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
            let c = cos(time);
            let s = sin(time);

            let cf = cos(-3.0 * 3.14 / 4.0);
            let sf = sin(-3.0 * 3.14 / 4.0);

            let S = transpose(mat4x4f(
                0.3, 0.0, 0.0, 0.0,
                0.0, 0.3, 0.0, 0.0,
                0.0, 0.0, 0.3, 0.0,
                0.0, 0.0, 0.0, 1.0
            ));

            let Ts = transpose(mat4x4f(
                1.0, 0.0, 0.0, 0.4,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            ));

            let R1 = transpose(mat4x4f(
                c  ,  -s, 0.0, 0.0,
                s  ,   c, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0
            ));

            let R2 = transpose(mat4x4f(
                1.0, 0.0, 0.0, 0.0,
                0.0,  cf, -sf, 0.0,
                0.0,  sf,  cf, 0.0,
                0.0, 0.0, 0.0, 1.0
            ));

            let T =  R2 * R1 * Ts * S;
            var position = (T * vec4f(input.position, 1.0)).xyz;
            output.position = vec4f(position.x, 2.0 * position.y, position.z * 0.5 + 0.5, 1.0);
            output.color    = input.color;
            return output;
        }

        @fragment fn fs_main(input: VertexOutput) -> @location(0) vec4f {
            return input.color;
        }
        `
    })

    const vertexPositions =  [
        [-0.5, -0.5, -0.3],
        [ 0.5, -0.5, -0.3],
        [ 0.5,  0.5, -0.3],
        [-0.5,  0.5, -0.3],
        [ 0.0,  0.0,  0.5]
    ]

    const vertexColors = [
        [  0, 255,   0, 255],
        [  0, 255,   0, 255],
        [  0, 255,   0, 255],
        [  0, 255,   0, 255],
        [  0,  80,   0, 255],
    ]

    const vertices = new Float32Array(5 * 4)
    const colors = new Uint8Array(vertices.buffer)

    for (let i = 0; i < vertexPositions.length; i++) {
        let vertexPosition = vertexPositions[i];
        let color = vertexColors[i];
        vertices.set(vertexPosition, i*(3+1));
        colors.set(color, 4*(3+(4*i)));
    }

    const vertexAndColorBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })

    const indices = new Uint32Array(
        [0, 1, 2, 0, 2, 3, 3, 4, 0, 0, 4, 1, 1, 4, 2, 2, 4, 3]
    )

    const indexBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    })

    const timeBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    const pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: [
                {
                    attributes: [
                        {shaderLocation: 0, offset: 0 , format: "float32x3"},
                        {shaderLocation: 1, offset: 12, format: "unorm8x4"}
                    ],
                    arrayStride: 16,
                }
            ]
        },
        fragment: {
            module,
            targets: [{format}]
        },
        layout: "auto",
        depthStencil: {
            format: "depth24plus", //????
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilReadMask: 0,
            stencilWriteMask: 0,
        }
    })

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{binding: 0, resource: timeBuffer}]
    });

    const depthTexture = device.createTexture({
        size: [300, 150, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const depthTextureView = depthTexture.createView();

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
            }],
            depthStencilAttachment: {
                view: depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        })

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
        requestAnimationFrame(frame)
    }

    requestAnimationFrame(frame)

}

pyramid()
