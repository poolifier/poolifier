try{
    throw new Error('jo this is an error');
} catch(e){
    const err = e instanceof Error ? e.message : e
    console.log(e instanceof Error)
    console.log(err instanceof Error)
}