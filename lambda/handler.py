import json
from datetime import date, datetime
import numpy as np
from concurrent.futures import ThreadPoolExecutor


def fft():
    data = np.random.rand(8192, 8192)
    start = datetime.timestamp(datetime.now()) * 1000
    np.fft.fft(data, axis=0)
    end = datetime.timestamp(datetime.now()) * 1000
    return (end - start)


def fft_thread():
    data = [np.random.rand(8192, 2048) for k in range(4)]
    start = datetime.timestamp(datetime.now()) * 1000
    with ThreadPoolExecutor(max_workers=4) as executor:
        for x in data:
            executor.submit(np.fft.fft, x, axis=0)
    end = datetime.timestamp(datetime.now()) * 1000
    return (end-start)


def recur_fibo(n):
    if n <= 1:
        return n
    else:
        return(recur_fibo(n-1) + recur_fibo(n-2))


def handler(event, context):

    # fib = recur_fibo(30)
    fib = fft()
    # fib = fft_thread()

    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
        'body': json.dumps({
            'message': 'running time {0}ms'.format(fib)
        })
    }


if __name__ == '__main__':
    # print(recur_fibo(30))
    print(datetime.timestamp(datetime.now()) * 1000)
    print(handler(event=None, context=None))
    print(datetime.timestamp(datetime.now()) * 1000)
