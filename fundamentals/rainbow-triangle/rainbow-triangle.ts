async function render() {

    // adapter -> prevents "works on my machine", helps write code that
    // depends on the capabilities of the hardware
    const adapter = await navigator.gpu?.requestAdapter()
    const device = await adapter?.requestDevice()

    if (!device) {
        console.log("No GPU found")
        return
    }

    const canvas = document.querySelector('canvas')
    const context = canvas.getContext("webgpu")

    const preferredFormat = navigator.gpu.getPreferredCanvasFormat()
    context.configure({device, format: preferredFormat})

    const shader = device.createShaderModule({
        label: "rainbow triangle shader",
        code: /* wgsl */`
            struct VertexShaderOutput {
                @builtin(position) positionData: vec4f,
                @location(0) colorData: vec4f,
            }
            @vertex fn vs (
                @builtin(vertex_index) vertex_idx: u32
            ) -> VertexShaderOutput
            {
                let positions = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );
                let colors = array(
                    vec4f(1, 0, 0, 1),
                    vec4f(0, 1, 0, 1),
                    vec4f(0, 0, 1, 1),
                );
                var output: VertexShaderOutput;
                output.positionData = vec4f(positions[vertex_idx], 0, 1);
                output.colorData    = colors[vertex_idx];
                return output;
            }
            @fragment fn fs (input: VertexShaderOutput) -> @location(0) vec4f {
                return input.colorData;
            }
        `}
    )

    const pipeline = device.createRenderPipeline({
        label: 'rainbow triangle pipeline',
        layout: 'auto',
        vertex: {
            module: shader
        },
        fragment: {
            module: shader,
            targets: [{format: preferredFormat}]
        }
    })

    function rdr() {
        const encoder = device.createCommandEncoder()
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [1, 1, 1, 1],
                loadOp: 'clear',
                storeOp: 'store'
            }]
        })
        pass.setPipeline(pipeline)
        pass.draw(3)
        pass.end()
        const commands = encoder.finish()
        device.queue.submit([commands])
    }

    rdr()

}

render()
