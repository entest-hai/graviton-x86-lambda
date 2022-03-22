# Arm Gravition Versus X86 on Fibonaci and FFT Running Time

### Summary

According to [AWS Graviton2](https://aws.amazon.com/blogs/compute/migrating-aws-lambda-functions-to-arm-based-aws-graviton2-processors/) the Arm Graviton provides 34% better price performance than X86. In some sense, it runs faster 34% compared with X86. So I do a small experiment to check this. AWS CDK and CodeBuild with Arm based instance makes it easy to setup. **So the Graviton does run about 30% faster than X86**.

- Runtime Python 3.8
- Numpy 1.22.1
- Lambda memory 2048MB
- Lambda timeout 10 seconds


### CDK Pipeline
CDK make it very friendly to build this pipeline, feeling like pure programming infrastructure. 
![156108554-8f6f728f-cf18-4a08-b0df-2d9773e860aa](https://user-images.githubusercontent.com/20411077/159539715-aabce252-113c-4a07-babf-ae7a0d8b948c.png)

### Running time for Fibonaci
```
def recur_fibo(n):
    if n <= 1:
        return n
    else:
        return(recur_fibo(n-1) + recur_fibo(n-2))
```
n = 30 used for testing. 
![123456](https://user-images.githubusercontent.com/20411077/159539282-5b9b3574-03ea-4f5f-82b2-7a7e302bc0ce.png)

### Running time for FFT single thread
```
data = np.random.rand(8192, 8192)
np.fft.fft(data, axis=0)
```
![multi_thread_fft](https://user-images.githubusercontent.com/20411077/159542223-871f9b60-6cdf-435e-94d7-bdddb7c09c03.png)

### Running time for FFT multi-thread (Lambda memory 10240)
```
data = [np.random.rand(8192, 2048) for k in range(4)]
with ThreadPoolExecutor(max_worker=4) as executor:
  for x in data:
    executor.submit(np.fft.fft, x, axis=0)
```
![multi_thread_fft_1](https://user-images.githubusercontent.com/20411077/159552054-3b5b84e7-6b35-4c2a-9332-7801f92d5de4.png)
