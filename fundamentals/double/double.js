async function main () {
    const adapter = await navigator?.gpu.requestAdapter()
    const device = await adapter.requestDevice()

    if (!device) {
        console.log("GPU not found")
    }

    const module = device.createShaderModule({
        label: "doubling shader",
        code: `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        @compute @workgroup_size(1) fn cs(
            @builtin(global_invocation_id) id: vec3u
        ) {
            let i = id.x;
            data[i] = data[i] * 2.0;
        };
        `
    })

    const pipeline = device.createComputePipeline({
        label: "doubling pipeline",
        layout: 'auto',
        compute: {
            module
        }
    })

    const input = new Float32Array([1, 3, 5])

    const workBuffer = device.createBuffer({
        label: "work buffer",
        size: input.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    })

    device.queue.writeBuffer(workBuffer, 0, input)

    const outputBuffer = device.createBuffer({
        label: "output buffer",
        size: input.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    const bindGroup = device.createBindGroup({
        label: 'bindGroup for work buffer',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: {buffer: workBuffer}}
        ]
    })

    const encoder = device.createCommandEncoder({
        label: "doubling encoder"
    })
    const pass = encoder.beginComputePass({
        label: "doubling pass"
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(input.length)
    pass.end()

    encoder.copyBufferToBuffer(workBuffer, 0, outputBuffer, 0, outputBuffer.size)
    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
    
    await outputBuffer.mapAsync(GPUMapMode.READ)
    const result = new Float32Array(outputBuffer.getMappedRange().slice())
    outputBuffer.unmap()
    console.log(input)
    console.log(result)
}

main()
