async function simpleTextures() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter.requestDevice();
    if (!device) {
        console.log("No suitable GPU found");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('webgpu');
    context.configure({ device, format });
    const module = device.createShaderModule({
        code: /*wgsl*/ `

            struct VertexOutput {
                @builtin(position) position: vec4f,
            }

            @group(0) @binding(0) var texture: texture_2d<f32>;

            @vertex fn vs_main(@builtin(vertex_index) vIdx: u32) -> VertexOutput{
                let positions = array(
                    vec2f(-1.0, -1.0),
                    vec2f(-1.0,  1.0),
                    vec2f( 1.0,  -1.0),
                    vec2f(1.0, 1.0),
                    vec2f(-1.0, 1.0),
                    vec2f(1.0, -1.0),
                    // vec2f(-1.0,  1.0),
                    // vec2f( 1.0, -1.0),
                );
                let xy = positions[vIdx];
                var out: VertexOutput;
                out.position = vec4f(xy, 0.0, 1.0);
                return out;
            }

            @fragment fn fs_main(in: VertexOutput) -> @location(0) vec4f {
                let color = textureLoad(texture, vec2i(in.position.xy), 0).rgba;
                let corrected = pow(color.rgb, vec3f(1.0 / 2.2));
                return vec4f(corrected, 1.0);
            }
        `
    });
    let pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module
        },
        fragment: {
            module,
            targets: [{ format }]
        }
    });
    const simpleTextureDesc = {
        dimension: '2d',
        size: [256, 256, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        mipLevelCount: 1,
        sampleCount: 1,
        viewFormats: []
    };
    const simpleTexture = device.createTexture(simpleTextureDesc);
    let simpleGradient = Array(simpleTexture.width * simpleTexture.height * 4);
    for (let i = 0; i < simpleTexture.width; i++) {
        for (let j = 0; j < simpleTexture.height; j++) {
            let p = 4 * (j * simpleTexture.width + i);
            simpleGradient[p] = i;
            simpleGradient[p + 1] = j;
            simpleGradient[p + 2] = 128;
            simpleGradient[p + 3] = 255;
        }
    }
    let simpleGradientData = new Uint8Array(simpleGradient);
    device.queue.writeTexture({
        texture: simpleTexture,
        mipLevel: 0,
        origin: [0, 0, 0],
        aspect: 'all'
    }, simpleGradientData, {
        offset: 0,
        bytesPerRow: 4 * simpleTexture.width,
        rowsPerImage: simpleTexture.height
    }, simpleTextureDesc.size);
    // let bindGroup0Layout = device.create
    let bindGroup0 = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: simpleTexture.createView() }
        ]
    });
    let encoder = device.createCommandEncoder();
    let pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: [1, 1, 1, 1]
            }]
    });
    pass.setBindGroup(0, bindGroup0);
    pass.setPipeline(pipeline);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
simpleTextures();
