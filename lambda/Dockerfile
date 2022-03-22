FROM public.ecr.aws/lambda/python:3.8

# create code dir inside container
RUN mkdir ${LAMBDA_TASK_ROOT}/src

# copy code to container
COPY . ${LAMBDA_TASK_ROOT}/src

# copy handler function to container
COPY ./handler.py ${LAMBDA_TASK_ROOT}

# install dependencies for running time environment
RUN pip3 install -r ./src/requirements.txt --target "${LAMBDA_TASK_ROOT}"

# set the CMD to your handler
CMD [ "handler.handler" ]