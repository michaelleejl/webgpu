const rand = (min, max) => {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

async function uniformComplex() {
    let adapter = await navigator.gpu?.requestAdapter()
    let device = await adapter.requestDevice()
    if (!device){
        console.log("No GPU")
        return
    }
    let format = navigator.gpu?.getPreferredCanvasFormat()

    let canvas = document.querySelector('canvas')
    let context = canvas.getContext('webgpu')

    context.configure({device, format})

    let module = device.createShaderModule({
        code: /*wgsl*/ `
            struct Uniform {
                scale  : vec2f,
                offset : vec2f,
                color  : vec4f,
            };

            @group(0) @binding(0) var<uniform> uni: Uniform;

            @vertex fn vs(
                @builtin(vertex_index) vertexIdx: u32
            ) -> @builtin(position) vec4f {
                let positions = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );
                return vec4f((positions[vertexIdx] + uni.offset) * uni.scale, 0, 1);
            }

            @fragment fn fs() -> @location(0) vec4f {
            return uni.color;
            };
        `
    })

    let pipeline = device.createRenderPipeline({
        vertex: {
            module
        },
        layout: "auto",
        fragment: {
            module,
            targets: [{format}]
        }
    })

    let encoder = device.createCommandEncoder()

    const bufferSize  = 4 * (2 + 2 + 4);
    const scaleOff    = 0;
    const colorOff    = 2+2;
    const offsetOff   = 2;
    const numObjects  = 100;
    var objectInfos = [];

    for (var i=0; i < numObjects; i++) {
        var values   = new Float32Array(bufferSize / 4)
        let s = rand(0.2, 0.5)
        values.set([s, s], scaleOff)
        values.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], offsetOff)
        values.set([rand(0, 1), rand(0, 1), rand(0, 1), 1], colorOff)

        const buffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })

        const group = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{binding: 0, resource: {buffer}}],
        })

        objectInfos = objectInfos.concat({values, buffer, group})
    }

     const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: {r:1, g:1, b:1, a:1},
                loadOp: 'clear',
                storeOp: 'store'
            }]
        })

    pass.setPipeline(pipeline);

    for (var i = 0; i < objectInfos.length; i++) {
        let {values, buffer, group} = objectInfos[i]
        pass.setBindGroup(0, group);
        device.queue.writeBuffer(buffer, 0, values);
        pass.draw(3);
    }
    pass.end();
    device.queue.submit([encoder.finish()])


}

uniformComplex()
